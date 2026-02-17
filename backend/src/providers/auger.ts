import type { Locator } from 'playwright';
import { SupplierProvider, ProviderFetchResult } from './types';
import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';
import { loadSessionCache, saveSessionCache, clearSessionCache } from '../utils/session-cache';
import { withRetry } from '../utils/retry-helper';

const PLAYWRIGHT_LOGIN_ENABLED = (): boolean =>
  process.env.ENABLE_PLAYWRIGHT_LOGIN === '1' ||
  process.env.ENABLE_PLAYWRIGHT_LOGIN === 'true';

const PASSWORD_SELECTOR_FALLBACK =
  'input[name="password"], input[type="password"], [id=":r1:"], input#password';
const USER_SELECTOR_FALLBACK =
  'input[name="emailAddress"], input[type="email"], [id=":r0:"], input#email, input[type="text"]';

function normalizeSelector(sel: string | undefined | null): string | null {
  if (!sel) return null;
  if (sel.startsWith('[id=')) return sel;
  if (sel.startsWith('#:')) {
    return `[id="${sel.slice(1)}"]`;
  }
  return sel;
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
      logger.debug('Selector failed for %s', normalized);
    }
  }
  return null;
}

export class AugerProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    const supported = supplier.name.toLowerCase().includes('auger');
    logger.debug('[AugerProvider] checking support for %s => %s', supplier.name, supported);
    return supported;
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '25000', 10)
  ): Promise<ProviderFetchResult> {
    const result: ProviderFetchResult = { html: '', status: 500 };
    const cacheKey = String(supplier.id || supplier.name || 'auger');

    if (!PLAYWRIGHT_LOGIN_ENABLED()) {
      logger.warn('[AugerProvider] Playwright login disabled via env flag');
      return result;
    }

    if (!credential?.login || !credential?.password) {
      logger.error('[AugerProvider] Missing login credentials for Auger');
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
        storageState: cachedCookies ? { cookies: cachedCookies } : undefined
      });
      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      const loginUrl: string =
        (supplier as any).login_url || credential.url || supplier.base_url || 'https://portal.iamauger.com/login';

      const navigateToSearch = async () => {
        await page.goto(searchUrl, { waitUntil: 'networkidle' });
      };

      const isLoginPage = async (): Promise<boolean> => {
        const current = page.url().toLowerCase();
        if (current.includes('/login')) return true;
        const loginForm = await page.$('#Login');
        return Boolean(loginForm);
      };

      let sessionValid = false;
      let needsNavigationAfterLogin = true;

      try {
        await navigateToSearch();
        if (!(await isLoginPage())) {
          sessionValid = true;
          needsNavigationAfterLogin = false;
          logger.auger('[AugerProvider] Reusing cached session');
        }
      } catch (err) {
        logger.warn('[AugerProvider] initial session check failed: %s', (err as Error).message);
      }

      if (!sessionValid) {
       logger.auger('[AugerProvider] Session invalid or missing, starting login flow');
        clearSessionCache(cacheKey);

        await context.clearCookies();

       await withRetry(
         () => page.goto(loginUrl, { waitUntil: 'networkidle' }),
         { context: 'Auger login navigation' }
       );

       await withRetry(
         () => page.waitForSelector(USER_SELECTOR_FALLBACK, { timeout: 6000 }),
         { context: 'waiting for login form', maxRetries: 2 }
       ).catch(() => logger.warn('[AugerProvider] login fields not immediately visible'));

        await withRetry(
          () => page.waitForSelector(PASSWORD_SELECTOR_FALLBACK, { timeout: 6000 }),
          { context: 'waiting for password field', maxRetries: 2 }
        ).catch(() => logger.warn('[AugerProvider] password field not immediately visible'));

        const cookieButtons = [
          'button:has-text("Accept")',
          'button:has-text("Aceitar")',
          '#onetrust-accept-btn-handler',
          'button[aria-label*="accept"]'
        ];
        for (const btn of cookieButtons) {
          try {
            const cookieLocator = page.locator(btn).first();
            if (await cookieLocator.count() > 0) {
              await cookieLocator.click({ force: true });
              break;
            }
          } catch { /* ignore */ }
        }

        const overlaySelectors = ['.modalOverlay .close', '.modalContent .close', '.modalOverlay', 'button.close'];
        for (const sel of overlaySelectors) {
          try {
            const overlay = page.locator(sel).first();
            if (await overlay.count() > 0) {
              await overlay.click({ force: true });
            }
          } catch { /* ignore */ }
        }

        await page.evaluate(() => {
          const overlays = document.querySelectorAll('.modalOverlay, .modalContent');
          overlays.forEach(el => el.remove());
        }).catch(() => logger.debug('[AugerProvider] overlay removal via JS failed'));

        await page.waitForTimeout(800);

        const username = await findLocator(page, [
          supplier.login_selector || '',
          USER_SELECTOR_FALLBACK
        ]);
        let passwordInput = await findLocator(page, [
          supplier.password_selector || '',
          PASSWORD_SELECTOR_FALLBACK
        ]);
        if (!passwordInput) {
          const fallback = page.locator('input[type="password"]').first();
          if (await fallback.count() > 0) {
            passwordInput = { selector: 'input[type="password"]', locator: fallback };
          }
        }

        let submitButton = await findLocator(page, [
          supplier.submit_selector || '',
          '.btn-login',
          'button.btn-login',
          'button.form-control.btn.btn-primary.mb-2.btn-login',
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Login")',
          'button:has-text("Entrar")',
          'button:has-text("Sign in")'
        ]);
        if (!submitButton) {
          const fallbackSubmit = page.locator('button.btn-login, button[type="submit"]').first();
          if (await fallbackSubmit.count() > 0) {
            submitButton = { selector: 'button[type="submit"]', locator: fallbackSubmit };
          }
        }

        if (!username || !passwordInput || !submitButton) {
          logger.error('[AugerProvider] missing login fields (username=%s password=%s submit=%s)',
            !!username, !!passwordInput, !!submitButton);
          throw new Error('AUGER_LOGIN_FORM_NOT_FOUND');
        }

        await withRetry(async () => {
          await username.locator.fill('');
          await username.locator.type(credential.login, { delay: 30 });
          await passwordInput.locator.fill('');
          await passwordInput.locator.type(credential.password || '', { delay: 30 });
        }, { context: 'Auger filling credentials', maxRetries: 2 });

        let submitted = false;
        try {
          await submitButton.locator.click({ force: true });
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
            page.waitForTimeout(15000)
          ]);
          submitted = true;
        } catch (err) {
          logger.warn('[AugerProvider] submit click failed: %s', (err as Error).message);
        }

        if (!submitted) {
          try {
            await passwordInput.locator.focus();
            await page.keyboard.press('Enter');
            await Promise.race([
              page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
              page.waitForTimeout(15000)
            ]);
            submitted = true;
          } catch (err) {
            logger.warn('[AugerProvider] submit via Enter failed: %s', (err as Error).message);
          }
        }

        if (!submitted) {
          throw new Error('LOGIN_FAILED: Unable to submit login form');
        }

        await page.waitForSelector('#Login', { state: 'detached', timeout: 8000 }).catch(() => {
          logger.warn('[AugerProvider] login form still present after submit');
        });

        const afterLoginUrl = page.url().toLowerCase();
        if (afterLoginUrl.includes('/login')) {
          throw new Error('LOGIN_FAILED: Still on login page after submit');
        }

        sessionValid = true;
        needsNavigationAfterLogin = true;
      }

      if (!sessionValid) {
        throw new Error('LOGIN_FAILED: Unable to obtain authenticated session');
      }

      if (needsNavigationAfterLogin) {
        await navigateToSearch();
      }

      // Navigate/perform search
      let query = '';
      try {
        const parsed = new URL(searchUrl);
        query = parsed.searchParams.get('keyword') || parsed.searchParams.get('q') || '';
      } catch {
        query = '';
      }

      if (query) {
        try {
          const searchInput = await findLocator(page, [
            'input[name="keyword"]',
            'input[type="search"]',
            'input[placeholder*="Search"]',
            'input[placeholder*="Pesquisar"]'
          ]);
          if (searchInput) {
            await searchInput.locator.fill('');
            await searchInput.locator.type(query, { delay: 50 });
            await page.keyboard.press('Enter');
            await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
          } else {
            await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
          }
        } catch (err) {
          logger.warn('[AugerProvider] inline search failed, navigating directly: %s', (err as Error).message);
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
        }
      } else {
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
      }

      await page.waitForTimeout(2000);

      result.html = await page.content();
      result.status = 200;

      if (context) {
        const cookies = await context.cookies();
        saveSessionCache(cacheKey, cookies);
      }
    } catch (err) {
      logger.error('[AugerProvider] login flow failed: %s', (err as Error).message);
      clearSessionCache(cacheKey);
      result.error = err as Error;
    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (cleanupErr) {
        logger.warn('[AugerProvider] cleanup warning: %s', (cleanupErr as Error).message);
      }
    }

    return result;
  }
}
