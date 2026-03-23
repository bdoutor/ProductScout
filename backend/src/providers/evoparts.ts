import axios from 'axios';
import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';
import { getSupplierKey, getSupplierSessionCacheKey } from '../utils/supplier-utils';

const DEFAULT_BASE_URL = 'https://evoparts.pt';
const DEFAULT_LOGIN_URL = `${DEFAULT_BASE_URL}/login`;

const USERNAME_SELECTORS = [
  'input[name="loginModel.Username"]',
  '#loginModel_Username',
  'input[name="username"]',
  'input[type="email"]',
  'input[type="text"]'
];

const PASSWORD_SELECTORS = [
  'input[name="loginModel.Password"]',
  '#loginModel_Password',
  'input[name="password"]',
  'input[type="password"]'
];

const SUBMIT_SELECTORS = [
  'form[action="/login"] button[type="submit"]',
  'button:has-text("Login")',
  'button:has-text("Entrar")',
  'button[type="submit"]',
  'input[type="submit"]'
];

const RESULT_HINT_SELECTORS = [
  '.c_product_grid_details',
  '.c_product_item',
  '.l_product_item',
  '.paginatoin-area'
];

function normalizeBaseUrl(raw?: string | null): string {
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  return DEFAULT_BASE_URL;
}

function normalizeUrl(raw: string | null | undefined, baseUrl: string): string {
  if (!raw) return baseUrl;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return baseUrl;
  }
}

function resolveSearchUrl(searchUrl: string, baseUrl: string): string {
  const normalized = normalizeUrl(searchUrl, baseUrl);
  if (normalized && normalized.includes('{query}')) {
    return normalized.replace('{query}', '');
  }
  return normalized;
}

function extractSearchTerm(searchUrl: string): string {
  try {
    const parsed = new URL(searchUrl);
    const candidates = ['q', 'query', 'search', 's', 'term', 'text'];
    for (const key of candidates) {
      const value = parsed.searchParams.get(key);
      if (value && value.trim()) {
        return decodeURIComponent(value).trim();
      }
    }
  } catch {
    // ignore parse errors
  }
  return '';
}

async function findLocator(page: import('playwright').Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | null> {
  for (const selector of selectors) {
    if (!selector) continue;
    try {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0) {
        return { selector, locator };
      }
    } catch {
      logger.debug('[EvoPartsProvider] selector failed for %s', selector);
    }
  }
  return null;
}

async function dismissCookieBanner(page: import('playwright').Page): Promise<void> {
  const cookieSelectors = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Entendi")',
    'button:has-text("Aceitar")',
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'a:has-text("Aceitar")'
  ];

  for (const selector of cookieSelectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible()) {
        await locator.click({ force: true });
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // ignore missing cookie banner
    }
  }
}

async function isLoginPage(page: import('playwright').Page): Promise<boolean> {
  try {
    const currentUrl = page.url().toLowerCase();
    if (currentUrl.includes('/login')) return true;

    const loginForm = page.locator('form[action="/login"], input[name="loginModel.Username"], #loginModel_Username').first();
    if (await loginForm.count() > 0) {
      return true;
    }
  } catch {
    // if checks fail, assume not login page
  }
  return false;
}

async function isAuthenticatedSession(page: import('playwright').Page): Promise<boolean> {
  try {
    if (await isLoginPage(page)) return false;

    const loginLinks = await page.locator('a[href*="/login"]').count().catch(() => 0);

    const cookies = await page.context().cookies().catch(() => []);
    const hasAuthCookie = Array.isArray(cookies)
      ? cookies.some((cookie: any) => String(cookie?.name || '').toLowerCase() === 'yourauthcookie')
      : false;

    const accountHints = await page
      .locator('a:has-text("A minha conta"), a[href*="/conta" i], a[href*="/cliente" i], text=Bem vindo')
      .count()
      .catch(() => 0);

    const logoutHints = await page
      .locator('a[href*="logout" i], a:has-text("Sair"), a:has-text("Terminar sessão"), a:has-text("Log out")')
      .count()
      .catch(() => 0);

    if (accountHints > 0 || logoutHints > 0 || hasAuthCookie) {
      return true;
    }

    return loginLinks === 0;
  } catch {
    return false;
  }
}

function hasAuthenticatedPricingSignals(html: string): boolean {
  if (!html) return false;
  return (
    /GetPrecoArtigoEdisa/i.test(html) ||
    /var\s+poca_enti/i.test(html) ||
    /current_price/i.test(html) ||
    /priceCheck/i.test(html)
  );
}

/**
 * Full authenticated-page check used by the HTTP session path in scraper.ts.
 * Requires search results, pricing signals AND a valid client token.
 */
export function isAuthenticatedEvoPartsHtml(html: string): boolean {
  if (!html) return false;
  const hasResults = /Resultados da pesquisa/i.test(html) || /c_product_item/i.test(html);
  const hasPricingSignal = hasAuthenticatedPricingSignals(html);
  const clientTokenMatch = html.match(/if\s*\('([^']*)'\s*!=\s*''\)\s*\{/i);
  const hasClientToken = Boolean(clientTokenMatch?.[1]?.trim());
  return hasResults && hasPricingSignal && hasClientToken;
}

export function buildCookieHeaderForUrl(cookies: any[], targetUrl: string): string {
  if (!Array.isArray(cookies) || cookies.length === 0) return '';
  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return '';
  }

  return cookies
    .filter((cookie) => {
      const domain = String(cookie?.domain || '').replace(/^\./, '').toLowerCase();
      if (!domain) return false;
      return hostname === domain || hostname.endsWith(`.${domain}`);
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export async function fetchEvoPartsFromCachedSession(
  cacheKey: string,
  searchUrl: string,
  timeout: number
): Promise<{ html: string; status: number }> {
  const cookies = loadSessionCache(cacheKey);
  if (!cookies || cookies.length === 0) {
    return { html: '', status: 0 };
  }

  const cookieHeader = buildCookieHeaderForUrl(cookies, searchUrl);
  if (!cookieHeader) {
    return { html: '', status: 0 };
  }

  try {
    const response = await axios.get(searchUrl, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Cookie': cookieHeader,
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    const html = String(response.data || '');
    if (!isAuthenticatedEvoPartsHtml(html)) {
      return { html: '', status: response.status };
    }

    return { html, status: response.status };
  } catch {
    return { html: '', status: 0 };
  }
}

async function waitForAnyResultHint(page: import('playwright').Page): Promise<void> {
  for (const selector of RESULT_HINT_SELECTORS) {
    try {
      await page.locator(selector).first().waitFor({ state: 'visible', timeout: 6000 });
      return;
    } catch {
      // continue
    }
  }
}

async function runSearchFromTopField(
  page: import('playwright').Page,
  query: string,
  timeoutMs: number
): Promise<void> {
  if (!query) return;

  const inputSelectors = [
    'input[placeholder*="Pesquisar" i]',
    'input[name="search"]',
    'input[type="search"]',
    'form[action*="search" i] input[type="text"]'
  ];
  const submitSelectors = [
    'form[action*="search" i] button[type="submit"]',
    'button:has-text("Pesquisar")',
    'button[type="submit"]',
    'button:has(.fa-search), button:has(.icon-search)'
  ];

  const input = await findLocator(page, inputSelectors);
  if (!input) return;

  await input.locator.fill('');
  await input.locator.type(query, { delay: 15 });

  const submit = await findLocator(page, submitSelectors);
  if (submit) {
    await Promise.all([
      page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {}),
      submit.locator.click({ force: true }),
    ]);
  } else {
    await page.keyboard.press('Enter').catch(() => {});
  }

  await page.waitForTimeout(600);
}

export class EvoPartsProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    return getSupplierKey(supplier) === 'evoparts';
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = 25000
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };
    const cacheKey = getSupplierSessionCacheKey(supplier);
    const baseUrl = normalizeBaseUrl(supplier.base_url);
    const loginUrl = normalizeUrl((supplier as any).login_url || credential.url || DEFAULT_LOGIN_URL, baseUrl);
    const targetSearchUrl = resolveSearchUrl(searchUrl, baseUrl);
    const targetSearchTerm = extractSearchTerm(targetSearchUrl);

    if (!credential?.login || !credential?.password) {
      result.error = new Error('EVOPARTS_MISSING_CREDENTIALS');
      return result;
    }

    const browser = await getBrowser();
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      const cachedCookies = loadSessionCache(cacheKey);
      context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1366, height: 860 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        storageState: cachedCookies ? { cookies: cachedCookies } : undefined,
      });

      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      let sessionValid = false;

      try {
        await page.goto(targetSearchUrl, { waitUntil: 'commit', timeout: timeoutMs });
        await page.waitForLoadState('domcontentloaded', { timeout: Math.min(timeoutMs, 12000) }).catch(() => {});
        await dismissCookieBanner(page);
        if (await isAuthenticatedSession(page)) {
          sessionValid = true;
          logger.info('[EvoPartsProvider] reusing cached session');
        }
      } catch (err) {
        logger.warn('[EvoPartsProvider] session pre-check failed: %s', (err as Error).message);
      }

      if (!sessionValid) {
        await context.clearCookies();

        await withRetry(
          () => page.goto(loginUrl, { waitUntil: 'commit', timeout: timeoutMs }),
          { context: 'EvoParts login navigation', maxRetries: 2 }
        );
        await page.waitForLoadState('domcontentloaded', { timeout: Math.min(timeoutMs, 12000) }).catch(() => {});
        await dismissCookieBanner(page);

        const username = await findLocator(page, [
          supplier.login_selector || '',
          ...USERNAME_SELECTORS
        ]);
        const password = await findLocator(page, [
          supplier.password_selector || '',
          ...PASSWORD_SELECTORS
        ]);
        const submit = await findLocator(page, [
          supplier.submit_selector || '',
          ...SUBMIT_SELECTORS
        ]);

        if (!username || !password || !submit) {
          throw new Error('EVOPARTS_LOGIN_FORM_NOT_FOUND');
        }

        await withRetry(async () => {
          await username.locator.fill('');
          await username.locator.type(credential.login, { delay: 20 });
          await password.locator.fill('');
          await password.locator.type(credential.password || '', { delay: 20 });
        }, { context: 'EvoParts filling credentials', maxRetries: 2 });

        await Promise.all([
          page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {}),
          submit.locator.click({ force: true }),
        ]);
        await page.waitForTimeout(1000);

        if (!(await isAuthenticatedSession(page))) {
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(1000);
        }

        if (!(await isAuthenticatedSession(page))) {
          throw new Error('EVOPARTS_LOGIN_FAILED');
        }
      }

      await withRetry(
        () => page.goto(targetSearchUrl, { waitUntil: 'commit', timeout: timeoutMs }),
        { context: 'EvoParts search navigation', maxRetries: 2 }
      );
      await page.waitForLoadState('domcontentloaded', { timeout: Math.min(timeoutMs, 12000) }).catch(() => {});
      await dismissCookieBanner(page);
      const hasQueryInUrl = /[?&](?:s|search|q|query)=/i.test(targetSearchUrl);
      if (!hasQueryInUrl && targetSearchTerm) {
        await runSearchFromTopField(page, targetSearchTerm, timeoutMs).catch(() => {});
      }
      await waitForAnyResultHint(page).catch(() => {});
      await Promise.race([
        page.locator('.price_box .current_price, .price_box .priceCheck').first().waitFor({ state: 'visible', timeout: 6000 }),
        page.waitForTimeout(6000),
      ]).catch(() => {});
      await page.waitForTimeout(500);

      const finalHtml = await page.content();
      const finalAuth = await isAuthenticatedSession(page);
      if (!finalAuth || !hasAuthenticatedPricingSignals(finalHtml)) {
        throw new Error('EVOPARTS_SEARCH_UNAUTHENTICATED');
      }

      result.html = finalHtml;
      result.status = 200;

      const cookies = await context.cookies();
      saveSessionCache(cacheKey, cookies);
    } catch (err) {
      const message = (err as Error).message || '';
      logger.error('[EvoPartsProvider] flow failed: %s', message);
      if (/MISSING_CREDENTIALS|LOGIN_FORM_NOT_FOUND|LOGIN_FAILED/i.test(message)) {
        clearSessionCache(cacheKey);
      }
      result.error = err as Error;
    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (cleanupErr) {
        logger.warn('[EvoPartsProvider] cleanup warning: %s', (cleanupErr as Error).message);
      }
    }

    return result;
  }
}

