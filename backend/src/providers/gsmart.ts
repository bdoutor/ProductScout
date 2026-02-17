import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';

const DEFAULT_BASE_URL = 'https://eurocomp.gsmart.eu';

const USERNAME_SELECTORS = [
  '#UsuarioUsername',
  'input[name="data[Usuario][username]"]',
  'input[name="usuario"]',
  'input[name="username"]',
  'input[type="email"]'
];

const PASSWORD_SELECTORS = [
  '#UsuarioPassword',
  'input[name="data[Usuario][password]"]',
  'input[name="password"]',
  'input[type="password"]'
];

const SUBMIT_SELECTORS = [
  '#UsuarioLoginForm input[type="submit"]',
  'button.gs-button',
  'button:has-text("Entrar")',
  'button:has-text("Login")',
  'button[type="submit"]',
];

const SEARCH_INPUT_SELECTORS = [
  '#producto-busqueda-js',
  'input[name="buscar_codigo"]',
  'input[name="codigo"]',
  'input[name="q"]',
  'input[type="search"]',
  'input[placeholder*="Buscar"]',
  'input[placeholder*="Pesquisar"]',
  'input[placeholder*="Pesquisa"]'
];

const SEARCH_BUTTON_SELECTORS = [
  '#buscar-cabecera-js',
  'button:has-text("Buscar")',
  'button:has-text("Pesquisar")',
  'button.gs-button',
  '.buscador button[type="submit"]'
];

const RESULT_HINT_SELECTORS = [
  '#div-listado table tbody tr',
  '.cnt-listado table tbody tr',
  '.cnt-listado .table tbody tr',
  '.lista-articulos table tbody tr',
  '.lista-articulos li',
  '.table tbody tr',
  '.listadoStock table tbody tr'
];

const QUERY_PARAM_CANDIDATES = [
  'q',
  'query',
  'search',
  's',
  'codigo',
  'code',
  'articulo',
  'art',
  'referencia',
  'reference',
  'term',
  'texto',
  'numero'
];

function unique<T>(values: Array<T | null | undefined>): T[] {
  return Array.from(new Set(values.filter((value): value is T => value !== null && value !== undefined)));
}

function normalizeBaseUrl(raw?: string | null): string {
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
}

function normalizeUrl(url: string | null | undefined, baseUrl: string): string {
  if (!url) return baseUrl;
  try {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    const resolved = new URL(url, baseUrl);
    return resolved.href;
  } catch {
    return baseUrl;
  }
}

async function findLocator(page: import('playwright').Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | null> {
  for (const raw of selectors) {
    if (!raw) continue;
    try {
      const locator = page.locator(raw).first();
      if (await locator.count() > 0) {
        return { selector: raw, locator };
      }
    } catch {
      logger.debug('[GsmartProvider] selector failed for %s', raw);
    }
  }
  return null;
}

async function dismissCookieBanner(page: import('playwright').Page): Promise<void> {
  const selectors = [
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyButtonAccept',
    '#CybotCookiebotDialogBodyLevelButtonAccept',
    'button:has-text("Aceitar")',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Acceptar")',
    'button:has-text("Aceptar")',
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
      // ignore missing banner
    }
  }
}

async function isLoginPage(page: import('playwright').Page): Promise<boolean> {
  try {
    const current = page.url().toLowerCase();
    if (current.includes('/usuarios/log')) return true;
    if (current.includes('/usuarios/login')) return true;
    const loginForm = page.locator('#UsuarioLoginForm, form[action*="usuarios/login"]').first();
    if (await loginForm.count() > 0 && await loginForm.isVisible().catch(() => false)) {
      return true;
    }
    const bodyClass = await page.getAttribute('body', 'class').catch(() => '');
    if (bodyClass && bodyClass.includes('body-login')) {
      return true;
    }
  } catch {
    // ignore detection errors and assume not a login page
  }
  return false;
}

async function waitForTurnstileToken(page: import('playwright').Page): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
      return Boolean(input && input.value && input.value.length > 10);
    }, { timeout: 15000 });
  } catch {
    logger.warn('[GsmartProvider] Cloudflare Turnstile token not detected before submit');
  }
}

async function waitForResults(page: import('playwright').Page): Promise<void> {
  for (const selector of RESULT_HINT_SELECTORS) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      const count = await locator.count();
      if (count > 0) {
        return;
      }
    } catch {
      // try next selector
    }
  }
}

function extractQueryValue(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    for (const key of QUERY_PARAM_CANDIDATES) {
      const value = parsed.searchParams.get(key);
      if (value) {
        return decodeURIComponent(value).trim();
      }
    }
    const cleanPath = parsed.pathname.replace(/\/$/, '');
    const segments = cleanPath.split('/').filter(Boolean);
    const last = segments.pop();
    if (last && last.length < 80) {
      return decodeURIComponent(last);
    }
  } catch {
    // ignore
  }

  if (candidate.includes('=')) {
    const raw = candidate.slice(candidate.lastIndexOf('=') + 1);
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  }

  return null;
}

function buildSearchCandidates(primary: string, baseUrl: string, query: string | null): string[] {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const templateCandidates = query
    ? [
        `${normalizedBase}/seleccion_articulos/articulos/index?buscar=${encodeURIComponent(query)}`,
        `${normalizedBase}/seleccion_articulos/articulos/listado?buscar=${encodeURIComponent(query)}`,
        `${normalizedBase}/seleccion_articulos/articulos?buscar=${encodeURIComponent(query)}`,
        `${normalizedBase}/?buscar=${encodeURIComponent(query)}`
      ]
    : [];

  return unique([
    primary,
    ...templateCandidates,
    normalizedBase
  ]);
}

async function performInlineSearch(page: import('playwright').Page, query: string | null): Promise<void> {
  if (!query) return;
  const input = await findLocator(page, SEARCH_INPUT_SELECTORS);
  if (!input) {
    logger.warn('[GsmartProvider] search input not found for inline search');
    return;
  }

  await input.locator.fill('');
  await input.locator.type(query, { delay: 35 }).catch(() => {});

  const button = await findLocator(page, SEARCH_BUTTON_SELECTORS);
  if (button) {
    await Promise.all([
      button.locator.click({ force: true }).catch(() => {}),
      page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
    ]);
  } else {
    await input.locator.press('Enter').catch(() => page.keyboard.press('Enter').catch(() => {}));
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  }

  await waitForResults(page);
}

async function ensureLoggedIn(
  page: import('playwright').Page,
  loginUrls: string[],
  credential: SupplierCredential
): Promise<void> {
  let lastIssue = 'login form not found';
  for (const url of loginUrls) {
    try {
      await withRetry(
        () => page.goto(url, { waitUntil: 'domcontentloaded' }),
        { context: `Gsmart login navigation (${url})`, maxRetries: 3 }
      );
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(400);
      await dismissCookieBanner(page);

      if (!(await isLoginPage(page))) {
        return;
      }

      const username = await findLocator(page, USERNAME_SELECTORS);
      const password = await findLocator(page, PASSWORD_SELECTORS);
      const submit = await findLocator(page, SUBMIT_SELECTORS);

      if (!username || !password || !submit) {
        lastIssue = `missing login elements at ${url}`;
        continue;
      }

      await waitForTurnstileToken(page);

      await withRetry(async () => {
        await username.locator.fill('');
        await username.locator.type(credential.login, { delay: 25 });
        await password.locator.fill('');
        await password.locator.type(credential.password || '', { delay: 25 });
      }, { context: 'Gsmart typing credentials', maxRetries: 2 });

      let submitted = false;
      try {
        await Promise.all([
          submit.locator.click({ force: true }),
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
        ]);
        submitted = true;
      } catch (err) {
        logger.warn('[GsmartProvider] submit click failed: %s', err instanceof Error ? err.message : String(err));
      }

      if (!submitted) {
        await password.locator.press('Enter').catch(() => page.keyboard.press('Enter')).catch(() => {});
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      }

      await page.waitForTimeout(800);

      if (!(await isLoginPage(page))) {
        return;
      }

      lastIssue = 'credentials rejected or still on login page';
    } catch (err) {
      lastIssue = err instanceof Error ? err.message : String(err);
      logger.warn('[GsmartProvider] login attempt failed (%s): %s', url, lastIssue);
    }
  }

  throw new Error(`LOGIN_FAILED: ${lastIssue}`);
}

export class GsmartProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    const name = supplier.name?.toLowerCase() || '';
    const base = supplier.base_url?.toLowerCase() || '';
    return name.includes('gsmart') || base.includes('gsmart.eu');
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = 25000
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };

    if (!credential?.login || !credential?.password) {
      result.error = new Error('Missing GSMART credentials');
      return result;
    }

    const baseUrl = normalizeBaseUrl(supplier.base_url);
    const normalizedSearchUrl = normalizeUrl(searchUrl, baseUrl);
    const queryValue = extractQueryValue(normalizedSearchUrl) || extractQueryValue(searchUrl);
    const loginCandidates = unique([
      normalizeUrl((supplier as any).login_url, baseUrl),
      normalizeUrl(credential.url, baseUrl),
      `${baseUrl}/usuarios/login`,
      `${baseUrl}/usuarios/log`,
      `${baseUrl}/usuarios/logon`,
      baseUrl
    ]);
    const searchCandidates = buildSearchCandidates(normalizedSearchUrl, baseUrl, queryValue);
    const cacheKey = `gsmart-${supplier.id || supplier.name || 'default'}`;

    const browser = await getBrowser();
    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

    try {
      const cachedCookies = loadSessionCache(cacheKey);
      context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1366, height: 860 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8,es;q=0.7'
        },
        storageState: cachedCookies ? { cookies: cachedCookies } : undefined,
      });

      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // Always ensure login first so we don't misinterpret the generic "error" page
      try {
        await ensureLoggedIn(page, loginCandidates, credential);
      } catch (loginErr) {
        clearSessionCache(cacheKey);
        throw loginErr;
      }

      // Make sure we're sitting on a page that actually exposes the quick-search bar
      const searchHubCandidates = unique([
        page.url(),
        ...searchCandidates,
        `${baseUrl}/seleccion_articulos/articulos/index`,
        `${baseUrl}/seleccion_articulos/articulos`,
        `${baseUrl}/seleccion_articulos`,
        baseUrl
      ]);

      let hubReady = false;
      for (const candidate of searchHubCandidates) {
        try {
          await withRetry(
            () => page.goto(candidate, { waitUntil: 'domcontentloaded' }),
            { context: `Gsmart search hub navigation (${candidate})`, maxRetries: 2 }
          );
          await page.waitForLoadState('networkidle').catch(() => {});
          await dismissCookieBanner(page);
          const quickSearch = await findLocator(page, SEARCH_INPUT_SELECTORS);
          if (quickSearch) {
            hubReady = true;
            break;
          }
        } catch (navErr) {
          logger.warn('[GsmartProvider] navigation to %s failed: %s', candidate, navErr instanceof Error ? navErr.message : String(navErr));
        }
      }

      if (!hubReady) {
        throw new Error('SEARCH_FORM_NOT_FOUND: Unable to locate GSMART reference search box');
      }

      await performInlineSearch(page, queryValue);

      await waitForResults(page);
      await page.waitForTimeout(1200);

      result.html = await page.content();
      result.status = 200;

      const cookies = await context.cookies();
      saveSessionCache(cacheKey, cookies);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[GsmartProvider] login/search failed: %s', message);
      result.error = err as Error;
      clearSessionCache(cacheKey);
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
