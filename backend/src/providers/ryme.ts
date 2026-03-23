import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';
import { getSupplierKey, getSupplierSessionCacheKey } from '../utils/supplier-utils';

const DEFAULT_BASE_URL = 'https://b2b.rymeautomotive.com/pt';

const USERNAME_SELECTORS = [
  'input[name="login"]',
  'input[name="usuario"]',
  'input[name="user"]',
  'input[name="username"]',
  'input[placeholder*="Usuário" i]',
  'input[placeholder*="Usuario" i]',
  'input[type="email"]',
];

const PASSWORD_SELECTORS = [
  'input[name="password"]',
  'input[type="password"]',
  'input[name="contrasena"]',
  'input[name="senha"]',
];

const REMEMBER_ME_SELECTORS = [
  'input[name="rememberMe"]',
  'input[type="checkbox"][name*="remember" i]',
  'input[type="checkbox"][name*="mantener" i]',
  'input[type="checkbox"][name*="manter" i]',
  'input[type="checkbox"][name*="session" i]',
];

// Specific to avoid hitting cookie banner buttons
const SUBMIT_SELECTORS = [
  'button:has-text("Acessar")',
  'button:has-text("ACESSAR")',
  'button:has-text("ACCEDER")',
  'button:has-text("Acceder")',
  'button:has-text("Entrar")',
  'form:not([action*="cookie"]) button[type="submit"]',
];

const SEARCH_INPUT_SELECTORS = [
  'input[placeholder*="Referência" i]',
  'input[placeholder*="Referencia" i]',
  'input[placeholder*="descrição" i]',
  'input[placeholder*="descripcion" i]',
  'input[name="texto"]',
  'input[name="q"]',
  'input[name="search"]',
  'input[type="search"]',
];

const SEARCH_BUTTON_SELECTORS = [
  'button:has-text("BUSCAR")',
  'button:has-text("Buscar")',
  'button:has-text("Pesquisar")',
  '.btn-search',
  'button[type="submit"]',
];

async function findLocator(page: import('playwright').Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | null> {
  for (const selector of selectors) {
    if (!selector) continue;
    try {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0) {
        return { selector, locator };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function isLoggedIn(page: import('playwright').Page): Promise<boolean> {
  try {
    const currentUrl = page.url().toLowerCase();
    if (currentUrl.includes('/login') || currentUrl.includes('/acceso')) return false;

    const loginFormCount = await page.locator('input[type="password"]:visible').count().catch(() => 0);
    if (loginFormCount > 0) return false;

    // Ryme shows search field when logged in
    const searchInputCount = await page
      .locator('input[placeholder*="Referência" i], input[placeholder*="Referencia" i], input[placeholder*="descrição" i]')
      .count()
      .catch(() => 0);

    const accountCount = await page
      .locator('a[href*="logout"], a[href*="salir"], a[href*="sair"], .user-info, .account-area, .my-account')
      .count()
      .catch(() => 0);

    return searchInputCount > 0 || accountCount > 0;
  } catch {
    return false;
  }
}

async function dismissCookies(page: import('playwright').Page): Promise<void> {
  const selectors = [
    'button:has-text("Aceitar")',
    'button:has-text("Accept")',
    'button:has-text("OK")',
    '#onetrust-accept-btn-handler',
    '.cc-btn.cc-dismiss',
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
      // ignore
    }
  }
}

function extractQueryFromUrl(searchUrl: string): string {
  try {
    const parsed = new URL(searchUrl);
    const candidates = ['q', 'query', 'search', 'texto', 's', 'term', 'ref'];
    for (const key of candidates) {
      const val = parsed.searchParams.get(key);
      if (val) return decodeURIComponent(val);
    }
  } catch {
    // not a valid URL
  }
  return '';
}

export class RymeProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    return getSupplierKey(supplier) === 'ryme';
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = 30000
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };
    const cacheKey = getSupplierSessionCacheKey(supplier);
    const baseUrl = (supplier.base_url || DEFAULT_BASE_URL).replace(/\/$/, '');
    const loginUrl = (supplier as any).login_url || credential.url || baseUrl;
    const queryValue = extractQueryFromUrl(searchUrl);

    if (!credential?.login || !credential?.password) {
      result.error = new Error('RYME_MISSING_CREDENTIALS');
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
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        storageState: cachedCookies ? { cookies: cachedCookies } : undefined,
        extraHTTPHeaders: { 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' },
      });
      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // --- Session check ---
      let sessionValid = false;
      if (cachedCookies) {
        try {
          await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          await dismissCookies(page);
          sessionValid = await isLoggedIn(page);
          if (sessionValid) {
            logger.info('[RymeProvider] reusing cached session');
          }
        } catch {
          // will re-login
        }
      }

      // --- Login if needed ---
      if (!sessionValid) {
        clearSessionCache(cacheKey);
        await context.clearCookies();

        await withRetry(
          () => page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'Ryme login navigation', maxRetries: 2 }
        );
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        await dismissCookies(page);

        const username = await findLocator(page, USERNAME_SELECTORS);
        const password = await findLocator(page, PASSWORD_SELECTORS);
        const submit = await findLocator(page, SUBMIT_SELECTORS);

        if (!username || !password || !submit) {
          throw new Error('RYME_LOGIN_FORM_NOT_FOUND');
        }

        // Tick "Manter a sessão aberta" so the session survives longer
        const rememberMe = await findLocator(page, REMEMBER_ME_SELECTORS);
        if (rememberMe) {
          const checked = await rememberMe.locator.isChecked().catch(() => false);
          if (!checked) {
            await rememberMe.locator.click({ force: true }).catch(() => {});
            await page.waitForTimeout(200);
          }
        }

        await username.locator.fill('');
        await username.locator.type(credential.login, { delay: 20 });
        await password.locator.fill('');
        await password.locator.type(credential.password || '', { delay: 20 });

        await Promise.all([
          submit.locator.click({ force: true }),
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => {}),
        ]);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        await dismissCookies(page);

        sessionValid = await isLoggedIn(page);

        // Fallback: try Enter on password
        if (!sessionValid) {
          await password.locator.press('Enter').catch(() => page.keyboard.press('Enter').catch(() => {}));
          await page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => {});
          await page.waitForTimeout(800);
          sessionValid = await isLoggedIn(page);
        }

        if (!sessionValid) {
          throw new Error('RYME_LOGIN_FAILED');
        }
      }

      // --- Search ---
      // Ryme uses Angular SPA routing: search navigates to /advanced-search/{query}/any
      if (queryValue) {
        const rymeSearchUrl = `${baseUrl}/advanced-search/${encodeURIComponent(queryValue)}/any`;
        logger.debug('[RymeProvider] navigating to search URL: %s', rymeSearchUrl);
        await withRetry(
          () => page.goto(rymeSearchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'Ryme search navigation', maxRetries: 1 }
        );
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(800);
      }

      result.html = await page.content();
      result.status = 200;

      const cookies = await context.cookies();
      saveSessionCache(cacheKey, cookies);

    } catch (err) {
      const message = (err as Error).message || '';
      logger.error('[RymeProvider] failed: %s', message);
      if (/MISSING_CREDENTIALS|LOGIN_FORM_NOT_FOUND|LOGIN_FAILED/i.test(message)) {
        clearSessionCache(cacheKey);
      }
      result.error = err as Error;
    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch {}
    }

    return result;
  }
}
