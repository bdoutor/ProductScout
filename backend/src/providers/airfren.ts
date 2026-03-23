import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';
import { getSupplierKey, getSupplierSessionCacheKey } from '../utils/supplier-utils';

const DEFAULT_BASE_URL = 'https://airfren.com';
const DEFAULT_LOGIN_URL = 'https://airfren.com/login';

async function findLocator(page: import('playwright').Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | null> {
  for (const selector of selectors) {
    if (!selector) continue;
    try {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0) return { selector, locator };
    } catch { /* ignore */ }
  }
  return null;
}

async function dismissPrivacyBanner(page: import('playwright').Page): Promise<void> {
  const selectors = [
    'button:has-text("Acepto la política")',
    'button:has-text("Aceptar")',
    'button:has-text("Accept")',
    '#onetrust-accept-btn-handler',
    '.cc-btn.cc-dismiss',
  ];
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible()) {
        await loc.click({ force: true });
        await page.waitForTimeout(400);
        break;
      }
    } catch { /* ignore */ }
  }
}

async function isLoggedIn(page: import('playwright').Page): Promise<boolean> {
  try {
    const currentUrl = page.url().toLowerCase();
    if (currentUrl.includes('/login')) return false;

    // When logged in, the nav shows "Perfil" instead of "Registro"
    const perfilCount = await page
      .locator('a:has-text("Perfil"), .icon-usuario')
      .count()
      .catch(() => 0);

    // No visible login form
    const loginFormCount = await page
      .locator('input[name="usuario"]:visible')
      .count()
      .catch(() => 0);

    // Product cards should NOT have nologin class
    const nologinCount = await page
      .locator('.product-card-body.nologin')
      .count()
      .catch(() => 0);

    return perfilCount > 0 && loginFormCount === 0 && nologinCount === 0;
  } catch {
    return false;
  }
}

function extractQueryFromUrl(searchUrl: string): string {
  try {
    const parsed = new URL(searchUrl);
    for (const key of ['q', 'query', 'search', 'texto', 'term', 'ref', 's']) {
      const val = parsed.searchParams.get(key);
      if (val) return decodeURIComponent(val);
    }
  } catch { /* not a valid URL */ }
  return '';
}

export class AirFrenProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    return getSupplierKey(supplier) === 'airfren';
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
    const loginUrl = (supplier as any).login_url || credential.url || DEFAULT_LOGIN_URL;
    const queryValue = extractQueryFromUrl(searchUrl);

    if (!credential?.login || !credential?.password) {
      result.error = new Error('AIRFREN_MISSING_CREDENTIALS');
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
        extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,pt;q=0.8' },
      });
      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // --- Session check ---
      let sessionValid = false;
      if (cachedCookies) {
        try {
          await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          sessionValid = await isLoggedIn(page);
          if (sessionValid) {
            logger.info('[AirFrenProvider] reusing cached session');
          }
        } catch { /* will re-login */ }
      }

      // --- Login if needed ---
      if (!sessionValid) {
        clearSessionCache(cacheKey);
        await context.clearCookies();

        await withRetry(
          () => page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'AirFren login navigation', maxRetries: 2 }
        );
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

        // Dismiss privacy/cookie banner before interacting with form
        await dismissPrivacyBanner(page);

        const username = await findLocator(page, [
          '#login-email',
          'input[name="usuario"]',
          'input[type="email"]',
        ]);
        const password = await findLocator(page, [
          '#login-password',
          'input[name="password"]',
          'input[type="password"]',
        ]);
        const submit = await findLocator(page, [
          'button:has-text("Login")',
          'button:has-text("Acceder")',
          'button:has-text("Entrar")',
        ]);

        if (!username || !password || !submit) {
          throw new Error('AIRFREN_LOGIN_FORM_NOT_FOUND');
        }

        // Tick "Recordar contraseña"
        const rememberMe = await findLocator(page, ['#remember_me', 'input[type="checkbox"]']);
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

        sessionValid = await isLoggedIn(page);

        if (!sessionValid) {
          throw new Error('AIRFREN_LOGIN_FAILED');
        }
      }

      // --- Search ---
      // AirFren uses a direct URL pattern: /catalogo-productos?search=reference&q={query}
      if (queryValue) {
        const airfrenSearchUrl = `${baseUrl}/catalogo-productos?search=reference&q=${encodeURIComponent(queryValue)}`;
        logger.debug('[AirFrenProvider] navigating to search URL: %s', airfrenSearchUrl);
        await withRetry(
          () => page.goto(airfrenSearchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'AirFren search navigation', maxRetries: 1 }
        );
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(500);
      }

      result.html = await page.content();
      result.status = 200;

      const cookies = await context.cookies();
      saveSessionCache(cacheKey, cookies);

    } catch (err) {
      const message = (err as Error).message || '';
      logger.error('[AirFrenProvider] failed: %s', message);
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
