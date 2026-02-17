import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';
import fs from 'fs';
import path from 'path';

const USERNAME_SELECTORS = [
  'input[name="ctl00$box_3$tbUserId"]',
  '#ctl00_box_3_tbUserId',
  '#username',
  'input[name="username"]',
  'input[name="user_login"]',
  'input[name="email"]',
  'input[type="email"]',
];

const PASSWORD_SELECTORS = [
  'input[name="ctl00$box_3$tbPassword"]',
  '#ctl00_box_3_tbPassword',
  '#password',
  'input[name="password"]',
  'input[type="password"]',
];

const SUBMIT_SELECTORS = [
  'input[name="ctl00$box_3$btnLogin"]',
  'button[name="login"]',
  'button[type="submit"]',
  '.woocommerce-form-login__submit',
  'button:has-text("Login")',
  'button:has-text("Iniciar sessão")',
  'button:has-text("Entrar")',
];

const MARTEX_DEFAULT_BASE_URL = 'https://sklep.martextruck.pl';

function normalizeSelector(sel: string | undefined | null): string | null {
  if (!sel) return null;
  return sel;
}

async function dismissCookieBanner(page: import('playwright').Page): Promise<void> {
  const selectors = [
    '#CybotCookiebotDialogBodyButtonAccept',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyLevelButtonAccept',
    'button:has-text("Allow all")',
    'button:has-text("Allow selection")',
    'button:has-text("Akceptuj wszystkie")',
  ];

  for (const sel of selectors) {
    try {
      const locator = page.locator(sel).first();
      if (await locator.isVisible()) {
        await locator.click({ force: true });
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // ignore and try next selector
    }
  }

  await page.locator('#CybotCookiebotDialog, .CybotCookiebotDialog').waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
}

async function findLocator(page: import('playwright').Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | null> {
  for (const raw of selectors) {
    const normalized = normalizeSelector(raw);
    if (!normalized) continue;
    try {
      const locator = page.locator(normalized).first();
      if (await locator.count() > 0) {
        return { selector: normalized, locator };
      }
    } catch {
      logger.debug('[MartexProvider] selector failed for %s', normalized);
    }
  }
  return null;
}

function resolveMartexBaseUrl(raw?: string | null): string {
  if (raw && /martextruck\.pl/i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  return MARTEX_DEFAULT_BASE_URL;
}

function resolveMartexSearchUrl(rawUrl: string, baseUrl: string): string {
  const fallback = `${baseUrl.replace(/\/$/, '')}/partscatalogue/searchresult.aspx`;
  if (!rawUrl) {
    return fallback;
  }
  try {
    const parsed = rawUrl.startsWith('http')
      ? new URL(rawUrl)
      : new URL(rawUrl, baseUrl);
    if (parsed.hostname.toLowerCase().includes('martextruck')) {
      return parsed.href;
    }
    const queryValue =
      parsed.searchParams.get('search') ||
      parsed.searchParams.get('s') ||
      parsed.searchParams.get('q') ||
      '';
    if (queryValue) {
      return `${fallback}?search=${encodeURIComponent(queryValue)}`;
    }
  } catch {
    // ignore malformed URLs and use fallback below
  }
  return fallback;
}

function resolveMartexLoginUrl(supplier: Supplier, baseUrl: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const candidate = (supplier as any).login_url as string | null | undefined;

  if (candidate && /martextruck\.pl/i.test(candidate)) {
    return candidate.replace(/\/$/, '');
  }

  return `${normalizedBase}/pages/login.aspx`;
}

interface MartexAuthState {
  loggedIn: boolean;
  logoutHints: number;
  loggedTextHints: number;
  visibleLoginInputs: number;
  visibleLoginButtons: number;
  loginLinks: number;
}

async function getMartexAuthState(page: import('playwright').Page): Promise<MartexAuthState> {
  const loggedEnglish = await page.locator('text=/Logged/i').first().count().catch(() => 0);
  const loggedPolish = await page.locator('text=/Zalogowan/i').first().count().catch(() => 0);
  const logoutHints = await page.locator('a[href*="logout"], a:has-text("Wyloguj"), a:has-text("Log out")').count().catch(() => 0);
  const loginLinks = await page.locator('a:has-text("Zaloguj"), a:has-text("Login")').count().catch(() => 0);
  const visibleLoginInputs = await page.locator('input[name="ctl00$box_3$tbUserId"]:visible').count().catch(() => 0);
  const visibleLoginButtons = await page.locator('input[name="ctl00$box_3$btnLogin"]:visible').count().catch(() => 0);
  const loggedTextHints = loggedEnglish + loggedPolish;
  const loggedIn = logoutHints > 0 || (loggedTextHints > 0 && visibleLoginInputs === 0 && visibleLoginButtons === 0 && loginLinks === 0);

  return {
    loggedIn,
    logoutHints,
    loggedTextHints,
    visibleLoginInputs,
    visibleLoginButtons,
    loginLinks,
  };
}

async function isMartexLoggedIn(page: import('playwright').Page): Promise<boolean> {
  const state = await getMartexAuthState(page);
  return state.loggedIn;
}

export class MartexProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    return supplier.name.toLowerCase().includes('martex');
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = 20000
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };
    const cacheKey = `martex-${supplier.id || supplier.name || 'default'}`;

    try {
      const browser = await getBrowser();
      const cachedCookies = loadSessionCache(cacheKey);
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1366, height: 860 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1'
        },
        storageState: cachedCookies ? { cookies: cachedCookies } : undefined,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(Math.min(timeoutMs, 20000));

      const baseUrl = resolveMartexBaseUrl(supplier.base_url);
      const normalizedBase = baseUrl.replace(/\/$/, '');
      const loginCandidates = Array.from(new Set([
        resolveMartexLoginUrl(supplier, baseUrl),
        `${normalizedBase}/login.aspx`,
        `${normalizedBase}/pages/login.aspx`,
        `${normalizedBase}/`
      ]));
      const normalizedSearchUrl = resolveMartexSearchUrl(searchUrl, baseUrl);
      let searchQueryValue: string | null = null;
      try {
        const parsedSearch = new URL(normalizedSearchUrl);
        searchQueryValue =
          parsedSearch.searchParams.get('search') ||
          parsedSearch.searchParams.get('q') ||
          parsedSearch.searchParams.get('s');
      } catch {
        // ignore parsing issues
      }
      if (!searchQueryValue) {
        const parts = searchUrl.split('=');
        const guess = parts.length > 1 ? parts[parts.length - 1] : searchUrl;
        try {
          searchQueryValue = decodeURIComponent(guess).replace(/\+/g, ' ').trim();
        } catch {
          searchQueryValue = guess.trim();
        }
      }

      const ensureLoggedIn = async () => {
        let lastIssue: string | null = null;

        for (const candidate of loginCandidates) {
          const target = candidate.replace(/\/$/, '');
          await withRetry(
            () => page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 }),
            { context: `Martex login navigation (${target})`, maxRetries: 1 }
          );
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(400);
          await dismissCookieBanner(page);

          const preState = await getMartexAuthState(page);
          if (preState.loggedIn) {
            logger.debug('[MartexProvider] already logged in at %s (state=%j)', target, preState);
            return;
          }

          const username = await findLocator(page, USERNAME_SELECTORS);
          const password = await findLocator(page, PASSWORD_SELECTORS);
          const submit = await findLocator(page, SUBMIT_SELECTORS);

          if (!username || !password || !submit) {
            lastIssue = `login form not found at ${target} (state=${JSON.stringify(preState)})`;
            continue;
          }

          await withRetry(async () => {
            await username.locator.fill('');
            await username.locator.type(credential.login, { delay: 20 });
            await password.locator.fill('');
            await password.locator.type(credential.password || '', { delay: 20 });
          }, { context: 'Martex filling credentials', maxRetries: 1 });

          await withRetry(async () => {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
              submit.locator.click({ force: true }),
            ]);
          }, { context: 'Martex submit login', maxRetries: 1 });

          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(800);
          await dismissCookieBanner(page);

          const postState = await getMartexAuthState(page);
          if (postState.loggedIn) {
            logger.debug('[MartexProvider] login confirmed at %s (state=%j)', target, postState);
            return;
          }

          lastIssue = `credentials rejected or session not established at ${target} (state=${JSON.stringify(postState)})`;
        }

        throw new Error(`LOGIN_FAILED: ${lastIssue || 'unable to locate Martex login form'}`);
      };

      const performSearch = async () => {
        await withRetry(
          () => page.goto(`${normalizedBase}/partscatalogue/search.aspx`, { waitUntil: 'domcontentloaded', timeout: 15000 }),
          { context: 'Martex home warmup', maxRetries: 1 }
        ).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await dismissCookieBanner(page);

        const quickSearchInput = page.locator('input[name="ctl00$box_1$tbQuickSearch"], input[name="ctl00$box_3$tbQuickSearch"]').first();
        const quickSearchButton = page.locator('input[name="ctl00$box_1$btnQuickSearch"], input[name="ctl00$box_3$btnQuickSearch"]').first();

        if (await quickSearchInput.count() > 0 && await quickSearchButton.count() > 0) {
          logger.debug('[MartexProvider] using inline quick search flow');
          await withRetry(async () => {
            await quickSearchInput.fill('');
            const queryText = searchQueryValue || searchUrl;
            await quickSearchInput.type(queryText, { delay: 30 });
          }, { context: 'Martex fill quick search', maxRetries: 1 });

          await withRetry(async () => {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
              quickSearchButton.click({ force: true })
            ]);
          }, { context: 'Martex quick search submit', maxRetries: 1 });
        } else {
          logger.debug('[MartexProvider] inline quick search not available, navigating directly');
          await withRetry(
            () => page.goto(normalizedSearchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }),
            { context: 'Martex search navigation direct', maxRetries: 1 }
          );
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        }

        await dismissCookieBanner(page);

        await page.waitForSelector('.partscontrol-box', { timeout: 15000 }).catch(() => {});
        await page.waitForFunction(() => {
          const boxes = document.querySelectorAll('.partscontrol-box');
          return Array.from(boxes).some(box => /Gross price|Cena brutto|Central|Centrala|pcs|szt/i.test(box.textContent || ''));
        }, { timeout: 8000 }).catch(() => {});
        const priceSelector = '.partscontrol-box-articles-price-gross';
        const priceReady = await page.waitForSelector(priceSelector, { timeout: 5000 }).catch(() => null);
        if (!priceReady) {
          await page.waitForFunction((selector: string) => {
            const el = document.querySelector(selector);
            return el && el.textContent && el.textContent.trim().length > 0;
          }, priceSelector, { timeout: 5000 }).catch(() => {});
        }
        await page.waitForTimeout(1000);
      };

      await ensureLoggedIn();
      await performSearch();
      const pageHtml = await page.content();

      if (/service\s+unavailable/i.test(pageHtml)) {
        throw new Error('SUPPLIER_UNAVAILABLE: Service returned HTTP 503');
      }

      const resultCount = await page.locator('.partscontrol-box').count().catch(() => 0);
      const priceHints = await page.locator('.partscontrol-box-articles-price-net, .partscontrol-box-articles-price-gross').count().catch(() => 0);
      const authState = await getMartexAuthState(page);
      const isLogged = authState.loggedIn;

      if (!isLogged) {
        logger.warn('[MartexProvider] session check failed after search (items=%d, priceHints=%d, state=%j)', resultCount, priceHints, authState);
        throw new Error('LOGIN_FAILED: session not active after loading Martex search results');
      }

      // Se não encontrámos spans de preço, tratamos como falha para não cachear página sem preços
      if (priceHints === 0) {
        logger.warn('[MartexProvider] price hints not found after search (items=%d, state=%j). Forcing relogin.', resultCount, authState);
        try {
          const logDir = path.resolve(__dirname, '..', 'logs');
          fs.mkdirSync(logDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const htmlPath = path.join(logDir, `martex-price-missing-${ts}.html`);
          const pngPath = path.join(logDir, `martex-price-missing-${ts}.png`);
          const pageHtml = await page.content();
          fs.writeFileSync(htmlPath, pageHtml, 'utf8');
          await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});
          logger.warn('[MartexProvider] saved debug snapshot for missing prices: %s (html) %s (png)', htmlPath, pngPath);
        } catch (snapErr: any) {
          logger.warn('[MartexProvider] failed to save debug snapshot: %s', snapErr?.message || snapErr);
        }
        throw new Error('PRICE_HINTS_MISSING');
      }

      result.html = pageHtml;
      result.status = 200;

      const cookies = await context.cookies();
      if (isLogged && priceHints > 0) {
        saveSessionCache(cacheKey, cookies);
      }

      await context.close();
    } catch (err) {
      logger.error('[MartexProvider] login/search failed: %s', (err as Error).message);
      clearSessionCache(cacheKey);
      result.error = err as Error;
    }

    return result;
  }
}
