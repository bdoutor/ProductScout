import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';

const USERNAME_SELECTORS = [
  'input[name="usuario"]',
  'input[placeholder*="Usuario" i]',
  'input[name="loginModel.Username"]',
  '#loginModel_Username',
  'input[name*="username" i]',
  'input[name*="login" i]',
  'input[type="text"]'
];

const PASSWORD_SELECTORS = [
  'input[name="contrasena"]',
  'input[placeholder*="Contra" i]',
  'input[name="loginModel.Password"]',
  '#loginModel_Password',
  'input[type="password"]',
  'input[name*="password" i]'
];

const SUBMIT_SELECTORS = [
  'form[action*="/login"] button[type="submit"]',
  'form[action*="/login"] input[type="submit"]',
  'button:has-text("Login")',
  'button:has-text("Entrar")',
  'button[type="submit"]',
  'button[type="button"]'
];

async function findLocator(page: import('playwright').Page, selectors: string[]): Promise<{ selector: string; locator: Locator } | null> {
  for (const raw of selectors) {
    try {
      const locator = page.locator(raw).first();
      if (await locator.count() > 0) {
        return { selector: raw, locator };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function dismissCookies(page: import('playwright').Page): Promise<void> {
  const selectors = [
    '#onetrust-accept-btn-handler',
    '.cc-btn.cc-dismiss',
    'button:has-text("Accept")',
    'button:has-text("Aceitar")',
    'button:has-text("Allow all")'
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

export class CasalsProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    return supplier.name.toLowerCase().includes('casals') || supplier.base_url?.includes('evoparts');
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '25000', 10)
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };
    const cacheKey = `casals-${supplier.id || supplier.name || 'default'}`;

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
        extraHTTPHeaders: {
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        },
      });
      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      const loginUrl = (supplier as any).login_url || credential.url || `${supplier.base_url}/login`;
      let sessionValid = false;

      // Quick session check
      try {
        await page.goto(supplier.base_url || 'https://evoparts.pt', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        const loginLink = await page.locator('a[href*="/login"]').count().catch(() => 0);
        const logoutLink = await page.locator('a[href*="/logout"], a:has-text("Logout"), a:has-text("Sair")').count().catch(() => 0);
        if (logoutLink > 0 && loginLink === 0) {
          sessionValid = true;
          logger.info('[CasalsProvider] Reusing cached session');
        }
      } catch {
        // ignore
      }

      if (!sessionValid) {
        clearSessionCache(cacheKey);
        await context.clearCookies();

        await withRetry(
          () => page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'Casals login navigation', maxRetries: 1 }
        );
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await dismissCookies(page);

        const username = await findLocator(page, USERNAME_SELECTORS);
        const password = await findLocator(page, PASSWORD_SELECTORS);
        const submit = await findLocator(page, SUBMIT_SELECTORS);

        if (!username || !password || !submit) {
          throw new Error('CASALS_LOGIN_FORM_NOT_FOUND');
        }

        await username.locator.fill('');
        await username.locator.type(credential.login, { delay: 20 });
        await password.locator.fill('');
        await password.locator.type(credential.password || '', { delay: 20 });

        await submit.locator.click({ force: true }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => {});

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await dismissCookies(page);
        await page.waitForTimeout(1000);

        const errorVisible = await page.locator('.validation-summary-errors, .span-error-qtd, .error').count().catch(() => 0);
        const stillLogin = await page.locator('form[action*="login"] input[type="password"], input[name="contrasena"]').count().catch(() => 0);
        const logoutLink = await page.locator('a[href*="logout"], a:has-text("Logout"), a:has-text("Sair"), a:has-text("Salir")').count().catch(() => 0);
        const onMenu = /menu\.php/i.test(page.url());
        if (errorVisible > 0 || (!onMenu && stillLogin > 0 && logoutLink === 0)) {
          throw new Error('LOGIN_FAILED: invalid credentials or login not accepted');
        }
      }

      // Navigate to search or homepage
      const targetUrl = searchUrl || supplier.search_url_template?.replace('{query}', '') || (supplier.base_url || 'https://pedidos.casalsmd.com');
      const base = supplier.base_url || 'https://pedidos.casalsmd.com';

      const runSearch = async (codeValue: string, descValue: string): Promise<number> => {
        await withRetry(
          () => page.goto(`${base.replace(/\/$/, '')}/articulos.php`, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
          { context: 'Casals articulos navigation', maxRetries: 1 }
        ).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        await dismissCookies(page);
        await page.waitForTimeout(500);
        const codeInput = page.locator('#codigo').first();
        const descInput = page.locator('#descripcion').first();
        const submitBtn = page.locator('button[type="submit"]').first();
        if (await codeInput.count()) {
          await codeInput.fill(codeValue || '');
        }
        if (await descInput.count()) {
          await descInput.fill(descValue || '');
        }
        if (await submitBtn.count()) {
          await submitBtn.click({ force: true }).catch(() => {});
        } else {
          await page.keyboard.press('Enter').catch(() => {});
        }
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200);
        return await page.locator('table.table tbody tr').count().catch(() => 0);
      };

      let queryValue = '';
      try {
        const parsed = new URL(searchUrl || targetUrl);
        queryValue = parsed.searchParams.get('q') || parsed.searchParams.get('search') || '';
      } catch {
        const parts = (searchUrl || '').split('=');
        queryValue = parts.length > 1 ? parts.pop() || '' : (searchUrl || '');
      }
      if (queryValue) {
        try { queryValue = decodeURIComponent(queryValue); } catch {}
      }

      let rows = await runSearch(queryValue, '');
      if (rows === 0 && queryValue) {
        rows = await runSearch('', queryValue);
      }

      result.html = await page.content();
      result.status = rows > 0 ? 200 : 204;

      if (context) {
        const cookies = await context.cookies();
        saveSessionCache(cacheKey, cookies);
      }
    } catch (err) {
      logger.error('[CasalsProvider] login/search failed: %s', (err as Error).message);
      clearSessionCache(cacheKey);
      result.error = err as Error;
    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch {
        // ignore
      }
    }

    return result;
  }
}
