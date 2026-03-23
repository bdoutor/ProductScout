import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';
import fs from 'fs';
import path from 'path';
import { getSupplierKey, getSupplierSessionCacheKey } from '../utils/supplier-utils';

type CookieParam = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  expires?: number;
};

const USERNAME_SELECTORS = [
  'input[name="username"]',
  'input[name="utilizador"]',
  'input[name="user"]',
  'input[id*="username"]',
  'input[id*="utilizador"]',
  'input[id*="login"]',
  'input[placeholder*="Utilizador" i]',
  'input[placeholder*="username" i]',
  'input[type="text"]'
];

const PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name="password"]',
  'input[name*="palavra"]',
  'input[id*="password"]',
  'input[placeholder*="palavra" i]',
  'input[id*="pass"]'
];

const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button:has-text("Entrar")',
  'input[type="submit"]'
];

const LOGOUT_SELECTORS = [
  'a[href*="logout"]',
  'a[href*="logoff"]',
  'a:has-text("Logout")',
  'a:has-text("Sair")'
];

const SEARCH_INPUT_SELECTORS = [
  'input[name="search"]',
  'input[name="referencia"]',
  'input[placeholder*="refer" i]',
  'input[type="search"]',
  'input[type="text"]'
];

const SEARCH_BUTTON_SELECTORS = [
  "#simpleResearchOE",
  "button#simpleResearchOE",
  "button:has-text(\"Pesquisar\")",
  "button[type=\"submit\"]",
  ".btn:has-text(\"Pesquisar\")",
  ".btn-primary:has-text(\"Pesquisar\")"
];

const TAB_REFERENCE_SELECTORS = [
  "#product_reference_oe",
  "a[href=\"#product_reference_oe\"]",
  "button:has-text(\"Referência\")",
  "a:has-text(\"Referência\")",
  "[role=\"tab\"]:has-text(\"Referência\")",
  "button:has-text(\"ReferA¦ncia\")",
  "button:has-text(\"Referência\")",
  "a:has-text(\"ReferA¦ncia\")",
  "a:has-text(\"Referência\")",
  "[role=\"tab\"]:has-text(\"ReferA¦ncia\")",
  "[role=\"tab\"]:has-text(\"Referência\")"
];

interface NipocarAuthState {
  loggedIn: boolean;
  logoutCount: number;
  accountCount: number;
  visibleNotLoggedMarkers: number;
  visibleLoginInputs: number;
  visibleSubmitButtons: number;
}

function toVisibleSelectorList(selectors: string[]): string {
  return selectors.map((s) => `${s}:visible`).join(',');
}

async function findLocator(
  page: import('playwright').Page,
  selectors: string[],
  options: { visible?: boolean } = {}
): Promise<{ selector: string; locator: Locator } | null> {
  for (const raw of selectors) {
    try {
      const locator = page.locator(raw).first();
      if (await locator.count() > 0) {
        if (options.visible) {
          const visible = await locator.isVisible().catch(() => false);
          if (!visible) continue;
        }
        return { selector: raw, locator };
      }
    } catch {
      // ignore selector failures
    }
  }
  return null;
}

async function hasLoginForm(page: import('playwright').Page): Promise<boolean> {
  try {
    const password = await page.locator(toVisibleSelectorList(PASSWORD_SELECTORS)).count().catch(() => 0);
    const submit = await page.locator(toVisibleSelectorList(SUBMIT_SELECTORS)).count().catch(() => 0);
    return password > 0 && submit > 0;
  } catch {
    return false;
  }
}

async function dismissCookies(page: import('playwright').Page): Promise<void> {
  const selectors = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Aceitar")',
    'button:has-text("Accept")',
    '.cc-btn.cc-dismiss',
    '.cookiebar button',
    '.cookie button',
    '.cookies button'
  ];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible()) {
        await loc.click({ force: true });
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // ignore missing cookie banners
    }
  }
}

async function closePopupIfAny(page: import('playwright').Page): Promise<void> {
  const selectors = [
    'button.close',
    '.modal-dialog .close',
    '.modal-header button[aria-label="Close"]',
    '[aria-label="Close"]',
    '.fancybox-close',
    '.swal2-close',
    '.overlay .close',
    '.popup .close'
  ];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible()) {
        await loc.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // ignore missing popups
    }
  }
}

async function getAuthState(page: import('playwright').Page): Promise<NipocarAuthState> {
  try {
    const logoutCount = await page.locator(toVisibleSelectorList(LOGOUT_SELECTORS)).count().catch(() => 0);
    const accountCount = await page
      .locator(
        'a[href*="dados-de-cliente"]:visible, a[href*="conta"]:visible, a:has-text("Meus dados"):visible, #LoginUserRegisterBtn [data-user-name]:visible, #LoginUserRegisterBtn .fa-user:visible'
      )
      .count()
      .catch(() => 0);
    const visibleNotLoggedMarkers = await page
      .locator('#nologinmenu:visible, .not_logged:visible, a[href*="/login"]:visible')
      .count()
      .catch(() => 0);
    const visibleLoginInputs = await page.locator(toVisibleSelectorList(USERNAME_SELECTORS)).count().catch(() => 0);
    const visibleSubmitButtons = await page.locator(toVisibleSelectorList(SUBMIT_SELECTORS)).count().catch(() => 0);

    const loggedIn = (logoutCount > 0 || accountCount > 0) && visibleNotLoggedMarkers === 0;
    return {
      loggedIn,
      logoutCount,
      accountCount,
      visibleNotLoggedMarkers,
      visibleLoginInputs,
      visibleSubmitButtons
    };
  } catch {
    return {
      loggedIn: false,
      logoutCount: 0,
      accountCount: 0,
      visibleNotLoggedMarkers: 0,
      visibleLoginInputs: 0,
      visibleSubmitButtons: 0
    };
  }
}

async function isLoggedIn(page: import('playwright').Page): Promise<boolean> {
  try {
    const state = await getAuthState(page);
    return state.loggedIn;
  } catch {
    return false;
  }
}

async function saveNipocarSnapshot(page: import('playwright').Page, reason: string): Promise<void> {
  try {
    const logDir = path.resolve(process.cwd(), 'backend', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeReason = reason.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const htmlPath = path.join(logDir, `nipocar-${safeReason}-${ts}.html`);
    const pngPath = path.join(logDir, `nipocar-${safeReason}-${ts}.png`);
    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf8');
    await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});
    logger.warn('[NipocarProvider] saved debug snapshot: %s and %s', htmlPath, pngPath);
  } catch (err) {
    logger.warn('[NipocarProvider] failed to save debug snapshot: %s', (err as Error)?.message || err);
  }
}

function extractQueryValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const candidates = ['search', 'q', 'query', 'referencia', 'reference'];
    for (const key of candidates) {
      const val = parsed.searchParams.get(key);
      if (val) return decodeURIComponent(val);
    }
  } catch {
    // ignore
  }
  if (raw.includes('=')) {
    const val = raw.slice(raw.lastIndexOf('=') + 1);
    return val || null;
  }
  return null;
}

async function selectReferenceTab(page: import('playwright').Page): Promise<void> {
  for (const sel of TAB_REFERENCE_SELECTORS) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible()) {
        await loc.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      // ignore selector failure
    }
  }
}

async function performReferenceSearch(page: import('playwright').Page, query: string): Promise<void> {
  if (!query) return;
  await selectReferenceTab(page);

  const input = await findLocator(page, SEARCH_INPUT_SELECTORS, { visible: true });
  if (input) {
    await input.locator.fill('');
    await input.locator.type(query, { delay: 20 }).catch(() => {});
  }

  const button = await findLocator(page, SEARCH_BUTTON_SELECTORS, { visible: true });
  if (button) {
    await Promise.all([
      button.locator.click({ force: true }).catch(() => {}),
      page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    ]);
  } else if (input) {
    await input.locator.press('Enter').catch(() => page.keyboard.press('Enter').catch(() => {}));
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  }

  await page.waitForTimeout(800);
}

function parseSetCookies(setCookies: string[], baseUrl: string): CookieParam[] {
  const { hostname } = new URL(baseUrl);
  const cookies: CookieParam[] = [];

  for (const raw of setCookies) {
    const parts = raw.split(';').map(p => p.trim());
    if (!parts[0] || !parts[0].includes('=')) continue;
    const [name, ...valueParts] = parts[0].split('=');
    const value = valueParts.join('=');
    if (!name || value === undefined) continue;

    const cookie: CookieParam = {
      name,
      value,
      domain: hostname,
      path: '/'
    };

    for (let i = 1; i < parts.length; i++) {
      const attr = parts[i];
      const [kRaw, vRaw] = attr.split('=');
      const key = kRaw?.toLowerCase();
      if (key === 'secure') cookie.secure = true;
      if (key === 'httponly') cookie.httpOnly = true;
      if (key === 'path' && vRaw) cookie.path = vRaw;
      if (key === 'samesite' && vRaw) {
        const vv = vRaw.toLowerCase();
        cookie.sameSite = vv === 'none' ? 'None' : vv === 'lax' ? 'Lax' : vv === 'strict' ? 'Strict' : undefined;
      }
      if (key === 'expires' && vRaw) {
        const ts = Date.parse(vRaw);
        if (!Number.isNaN(ts)) cookie.expires = Math.floor(ts / 1000);
      }
    }

    cookies.push(cookie);
  }

  return cookies;
}

async function loginViaAjax(
  page: import('playwright').Page,
  baseUrl: string,
  credential: SupplierCredential
): Promise<void> {
  const url = `${baseUrl}/ActionInvokerGenericAPI.ashx?input=dyn-post&output=json&ActionID=7471&ActionHash=C7BC96A6-EB01-4B77-A36C-184F774C65EC`;

  const formPayload: Record<string, string> = {
    num: credential.login,
    pw: credential.password || '',
    username: credential.login,
    browserInfo: JSON.stringify({ browser: ['Chrome', '120.0.0.0'], OS: 'Windows' }),
    botUserChannel: '',
    botUserId: '',
    checkSecurityLogin: '0',
    needResetPass: '[]'
  };

  const response = await page.request.post(url, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: baseUrl,
      referer: `${baseUrl}/pt-pt/login`,
      'x-requested-with': 'XMLHttpRequest'
    },
    form: formPayload
  });

  if (!response.ok()) {
    throw new Error(`NIPOCAR_LOGIN_AJAX_FAILED_STATUS_${response.status()}`);
  }

  const headersArray: Array<{ name: string; value: string }> =
    (response as any).headersArray?.() ||
    Object.entries(response.headers() || {}).map(([name, value]) => ({ name, value: String(value) }));

  const cookiesHeader = headersArray.filter((h: { name: string }) => h.name.toLowerCase() === 'set-cookie');
  const setCookies = cookiesHeader.map((h: { value: string }) => h.value);
  if (setCookies.length > 0) {
    const parsed = parseSetCookies(setCookies, baseUrl);
    if (parsed.length > 0) {
      await page.context().addCookies(parsed as any);
    }
  }
}

export class NipocarProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    return getSupplierKey(supplier) === 'nipocar';
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '25000', 10)
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };
    const cacheKey = getSupplierSessionCacheKey(supplier);
    const baseUrl = (supplier.base_url || 'https://nipocar.pt').replace(/\/$/, '');
    const loginUrl = (supplier as any).login_url || credential.url || `${baseUrl}/pt-pt/login`;
    const targetUrl = searchUrl || supplier.search_url_template?.replace('{query}', '') || baseUrl;
    const queryValue = extractQueryValue(searchUrl) || extractQueryValue(targetUrl);

    const browser = await getBrowser();
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      const cachedCookies = loadSessionCache(cacheKey);
      const acceptLang = process.env.NIPOCAR_ACCEPT_LANGUAGE || 'pt-PT,pt;q=0.9,en;q=0.5';
      context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1366, height: 860 },
        storageState: cachedCookies ? { cookies: cachedCookies } : undefined,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-PT',
        extraHTTPHeaders: {
          'Accept-Language': acceptLang
        }
      });
      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // Session check: if cookies exist, go directly to targetUrl (saves one full homepage navigation).
      // If session is invalid, fall through to the full login flow.
      let alreadyOnSearchPage = false;
      if (cachedCookies) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
          await closePopupIfAny(page);
          const cachedState = await getAuthState(page);
          if (cachedState.loggedIn) {
            logger.info('[NipocarProvider] Reusing cached session (direct to search page)');
            alreadyOnSearchPage = true;
          } else {
            logger.debug('[NipocarProvider] cached session invalid: %j', cachedState);
            throw new Error('SESSION_INVALID');
          }
        } catch {
          clearSessionCache(cacheKey);
          await context.clearCookies();
        }
      }

      if (!alreadyOnSearchPage) {
        // Try PT login first; if it fails, try EN login (site sometimes forces locale)
        const loginUrls = [
          loginUrl,
          `${baseUrl}/pt-pt/login`,
          `${baseUrl}/en-gb/login`
        ].filter(Boolean);

        let loginNavigated = false;
        for (const lu of loginUrls) {
          try {
            await withRetry(
              () => page.goto(lu, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
              { context: 'Nipocar login navigation', maxRetries: 2 }
            );
            loginNavigated = true;
            break;
          } catch {
            // try next locale
          }
        }

        if (!loginNavigated) {
          throw new Error('NIPOCAR_LOGIN_NAV_FAILED_ALL_LOCALES');
        }

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await dismissCookies(page);
        await closePopupIfAny(page);

        // First attempt direct AJAX login (does not redirect)
        let logged = false;
        try {
          await loginViaAjax(page, baseUrl, credential);
          await withRetry(
            () => page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
            { context: 'Nipocar post-ajax-login navigation', maxRetries: 1 }
          ).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(500);
          const afterAjaxState = await getAuthState(page);
          logged = afterAjaxState.loggedIn;
          logger.debug('[NipocarProvider] auth state after ajax login: %j', afterAjaxState);
        } catch {
          // ignore and fall back to UI login
        }

        // If still not logged, fall back to UI form submit
        if (!logged) {
          const username = await findLocator(page, USERNAME_SELECTORS, { visible: true });
          const password = await findLocator(page, PASSWORD_SELECTORS, { visible: true });
          const submit = await findLocator(page, SUBMIT_SELECTORS, { visible: true });

          if (!username || !password || !submit) {
            const stateNoForm = await getAuthState(page);
            logger.warn('[NipocarProvider] login form not found in UI flow (state=%j)', stateNoForm);
            throw new Error('NIPOCAR_LOGIN_FORM_NOT_FOUND');
          }

          await username.locator.fill('');
          await username.locator.type(credential.login, { delay: 20 });
          await password.locator.fill('');
          await password.locator.type(credential.password || '', { delay: 20 });

          await Promise.all([
            submit.locator.click({ force: true }).catch(() => {}),
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => {})
          ]);

          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(800);
          await dismissCookies(page);
          await closePopupIfAny(page);

          // Fallback submit with Enter if still on login form
          if (await hasLoginForm(page)) {
            await password.locator.press('Enter').catch(() => page.keyboard.press('Enter').catch(() => {}));
            await page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => {});
            await page.waitForTimeout(800);
            await dismissCookies(page);
            await closePopupIfAny(page);
          }

          const afterUiState = await getAuthState(page);
          logged = afterUiState.loggedIn;
          logger.debug('[NipocarProvider] auth state after UI login: %j', afterUiState);
        }

        // Fallback via AJAX API if UI login did not complete
        if (!logged) {
          await loginViaAjax(page, baseUrl, credential);
          await withRetry(
            () => page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
            { context: 'Nipocar post-ajax-login navigation', maxRetries: 1 }
          ).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(500);
          const afterRetryAjaxState = await getAuthState(page);
          logged = afterRetryAjaxState.loggedIn;
          logger.debug('[NipocarProvider] auth state after retry ajax: %j', afterRetryAjaxState);
        }

        const errorVisible = await page.locator('.validation-summary-errors:visible, .alert-danger:visible, .text-danger:visible').count().catch(() => 0);
        const finalAuthState = await getAuthState(page);
        if (errorVisible > 0 || !finalAuthState.loggedIn) {
          await saveNipocarSnapshot(page, 'login-failed');
          throw new Error(`LOGIN_FAILED: invalid credentials or blocked (state=${JSON.stringify(finalAuthState)})`);
        }

        await withRetry(
          () => page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'Nipocar search navigation', maxRetries: 1 }
        ).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        await closePopupIfAny(page);
      }

    if (queryValue) {
      await performReferenceSearch(page, queryValue);
    }

    // Give time for price widgets to render (they load via JS after search)
    try {
      await page.waitForSelector('.price_two, .price_two span, [class*=price]', { timeout: 5000 });
      await page.waitForTimeout(300); // small settle
    } catch {
      // ignore timeouts; we'll parse whatever is available
    }

    // If the page still looks unauthenticated after search, force a relogin + retry once.
    const authAfterSearch = await getAuthState(page);
    let notLoggedAfterSearch = !authAfterSearch.loggedIn;
    logger.debug('[NipocarProvider] auth state after search: %j', authAfterSearch);

    if (notLoggedAfterSearch) {
      logger.warn('[NipocarProvider] session not authenticated after search, retrying login');
      clearSessionCache(cacheKey);
      await context.clearCookies().catch(() => {});

      // Try AJAX login again, then reload target and redo search
      try {
        await loginViaAjax(page, baseUrl, credential);
        await withRetry(
          () => page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'Nipocar search navigation (retry)', maxRetries: 1 }
        ).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        await closePopupIfAny(page);

        if (queryValue) {
          await performReferenceSearch(page, queryValue);
        }

        try {
          await page.waitForSelector('.price_two, .price_two span, [class*=price]', { timeout: 7000 });
          await page.waitForTimeout(400);
        } catch {
          // still no price hints; fall through
        }

        const authAfterRetry = await getAuthState(page);
        notLoggedAfterSearch = !authAfterRetry.loggedIn;
        logger.debug('[NipocarProvider] auth state after search relogin retry: %j', authAfterRetry);
      } catch (retryErr) {
        logger.error('[NipocarProvider] relogin retry failed: %s', (retryErr as Error)?.message || retryErr);
      }
    }

    if (notLoggedAfterSearch) {
      await saveNipocarSnapshot(page, 'search-unauthenticated');
      throw new Error('LOGIN_FAILED: session not authenticated after search');
    }

    const resultCount = await page.locator('.winsig_product_item_list_custom').count().catch(() => 0);
    const priceHints = await page.locator('.price_two span').count().catch(() => 0);
    if (resultCount > 0 && priceHints === 0) {
      await saveNipocarSnapshot(page, 'prices-missing');
      throw new Error(`PRICE_HINTS_MISSING: result cards present without visible prices (results=${resultCount})`);
    }

      result.html = await page.content();
      result.status = 200;

      const cookies = await context.cookies();
      saveSessionCache(cacheKey, cookies);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[NipocarProvider] login/search failed: %s', message);
      clearSessionCache(cacheKey);
      result.error = err as Error;
    } finally {
      try {
        await page?.close();
      } catch {}
      try {
        await context?.close();
      } catch {}
    }

    return result;
  }
}


