import { Supplier, SupplierCredential } from '../types';
import { SupplierProvider, ProviderFetchResult } from './types';
import { getBrowser } from './playwright';
import { logger } from '../utils/logger';

function isPlaywrightEnabled(): boolean {
  return process.env.ENABLE_PLAYWRIGHT_LOGIN === '1' || process.env.ENABLE_PLAYWRIGHT_LOGIN === 'true';
}

export class AugerProvider implements SupplierProvider {
  supports(supplier: Supplier): boolean {
    const isAuger = supplier.name.toLowerCase().includes('auger');
    logger.debug('[AugerProvider] Checking support for %s: %s', supplier.name, isAuger);
    return isAuger;
  }

  async loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs: number = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '25000', 10)
  ): Promise<ProviderFetchResult> {
    logger.auger('[loginAndFetch] Starting with searchUrl: %s', searchUrl);

    if (!isPlaywrightEnabled()) {
      logger.error('Playwright disabled - check ENABLE_PLAYWRIGHT_LOGIN env var');
      throw new Error('PLAYWRIGHT_DISABLED');
    }

    if (!credential?.login || !credential?.password) {
      logger.error('Missing credentials for Auger');
      throw new Error('AUGER_MISSING_CREDENTIALS');
    }

    logger.auger('Initializing browser...');
    const browser = await getBrowser();
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1366, height: 860 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'pt-PT',
    });
    logger.auger('Browser context created, setting up page...');
    await context.addInitScript(() => {
      // executed in the browser context
      // @ts-ignore
      Object.defineProperty(window.navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      Object.defineProperty(window.navigator, 'languages', { get: () => ['pt-PT', 'pt', 'en-US'] });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    try {
      const loginUrl: string = (supplier as any).login_url || credential.url || supplier.base_url;
      logger.auger('Navigating to login URL: %s', loginUrl);

      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      logger.auger('Page loaded, waiting for login form...');

      // Ensure form is present (wait briefly)
      try {
        await page.waitForSelector('input[name="emailAddress"]', { timeout: 8000 });
        logger.auger('Login form found');
      } catch (e) {
        logger.warn('Login form not immediately visible, will try selectors anyway');
      }

      // Try to accept cookies if present
      const cookieButtons = [
        'button:has-text("Accept")',
        'button:has-text("Aceitar")',
        '#onetrust-accept-btn-handler',
        'button[aria-label*="accept"]'
      ];
      for (const btn of cookieButtons) {
        const el = await page.$(btn);
        if (el) { await el.click({ force: true }).catch(() => { }); break; }
      }

      logger.auger('Attempting to close modal overlay...');

      // Close modal overlay if covering the form
      const closeButtons = ['.modalOverlay .close', '.modalContent .close', '.modalOverlay', 'button.close'];
      for (const sel of closeButtons) {
        const el = await page.$(sel);
        if (el) {
          try {
            await el.click({ force: true });
            await page.waitForTimeout(1000);
            logger.auger('Clicked close button: %s', sel);
          } catch (e) {
            logger.warn('Failed to click close button %s: %s', sel, e);
          }
        }
      }

      // Remove overlay via JavaScript if still present
      try {
        await page.evaluate(() => {
          const overlays = document.querySelectorAll('.modalOverlay, .modalContent');
          overlays.forEach(el => el.remove());
          return overlays.length;
        }).then(count => {
          if (count > 0) logger.auger('Removed %d overlays via JS', count);
        });
      } catch (e) {
        logger.warn('Failed to remove overlays via JS:', e);
      }

      // Ensure modals are gone
      await page.waitForTimeout(1000);

      // Candidate selectors (allow DB-provided selectors first)
      const userSelectors = [
        supplier.login_selector,
        'input[name="emailAddress"]',
        '#:r0:', // Selector específico do Auger visto no HTML
        'input[name="username"]',
        'input[name="email"]',
        'input[type="email"]',
        'input#username',
        'input#email',
        'input[type="text"]'
      ].filter(Boolean) as string[];

      const passSelectors = [
        supplier.password_selector,
        'input[name="password"]',
        '#:r1:', // Selector específico do Auger visto no HTML
        'input#password',
        'input[type="password"]'
      ].filter(Boolean) as string[];

      const submitSelectors = [
        supplier.submit_selector,
        '.btn-login',
        'button.btn-login',
        'button.form-control.btn.btn-primary.mb-2.btn-login', // Selector completo do Auger
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Entrar")',
        'button:has-text("Sign in")'
      ].filter(Boolean) as string[];

      logger.auger('Trying to find login form elements...');

      let uSel: string | null = null;
      for (const sel of userSelectors) {
        if (await page.$(sel)) {
          uSel = sel;
          logger.auger('Found username field with selector: %s', sel);
          break;
        }
      }

      let pSel: string | null = null;
      for (const sel of passSelectors) {
        if (await page.$(sel)) {
          pSel = sel;
          logger.auger('Found password field with selector: %s', sel);
          break;
        }
      }

      let sSel: string | null = null;
      for (const sel of submitSelectors) {
        if (await page.$(sel)) {
          sSel = sel;
          logger.auger('Found submit button with selector: %s', sel);
          break;
        }
      }

      if (!uSel || !pSel || !sSel) {
        logger.error('Login form elements not found. Username: %s, Password: %s, Submit: %s',
          uSel ? 'OK' : 'Missing',
          pSel ? 'OK' : 'Missing',
          sSel ? 'OK' : 'Missing'
        );
        throw new Error('AUGER_LOGIN_FORM_NOT_FOUND');
      }

      await page.focus(uSel);
      await page.fill(uSel, '');
      await page.type(uSel, credential.login, { delay: 30 });
      await page.focus(pSel);
      await page.fill(pSel, '');
      await page.type(pSel, credential.password || '', { delay: 30 });

      // Try submitting by click first
      let submitted = false;

      try {
        logger.auger('Attempting to submit login form...');
        await page.click(sSel, { force: true });
        logger.auger('Clicked submit button, waiting for navigation...');

        // Longer wait for login processing
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          new Promise(r => setTimeout(r, 15000))
        ]);

        submitted = true;
        logger.auger('Login form submitted via click');
      } catch (e) {
        logger.warn('Click submit failed:', e);
      }

      // Fallback to Enter key if click failed
      if (!submitted) {
        logger.auger('Click submit failed, trying Enter key...');
        try {
          await page.focus(pSel);
          await page.keyboard.press('Enter');

          // Longer wait for login processing
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
            new Promise(r => setTimeout(r, 15000))
          ]);

          submitted = true;
          logger.auger('Login form submitted via Enter key');
        } catch (e) {
          logger.warn('Enter key submit failed:', e);
        }
      }

      // Wait for evidence of login success
      try {
        await page.waitForSelector('#Login', { state: 'detached', timeout: 8000 });
        logger.auger('Login form disappeared, probable success');
      } catch (e) {
        logger.warn('Login form still present:', e);
      }

      // Double check login status
      const currentUrl = (page.url() || '').toLowerCase();
      const stillHasLogin = (await page.$('#Login')) || (await page.$(uSel)) || (await page.$(pSel)) || (await page.$(sSel));
      if (currentUrl.includes('/login') || stillHasLogin) {
        logger.error('Still on login page after submit attempts');
        await context.close();
        throw new Error('LOGIN_FAILED: Still on login page after submit');
      }
      logger.auger('Successfully logged in');

      // Extract the query from the searchUrl if present
      let q = '';
      try {
        const u = new URL(searchUrl);
        q = u.searchParams.get('keyword') || u.searchParams.get('q') || '';
      } catch (e) {
        logger.warn('Failed to parse search URL:', e);
      }

      // Try on-page search if available
      const searchInput = await page.$('input[type="search"], input[placeholder*="Search" i], input[placeholder*="Pesquisar" i], input[placeholder*="procurando" i]');
      if (searchInput && q) {
        logger.auger('Found search input, attempting on-page search');
        await searchInput.fill('');
        await searchInput.type(q);
        await page.keyboard.press('Enter');
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          page.waitForTimeout(4000),
        ]);
        logger.auger('On-page search completed');
      } else {
        // Fallback to direct URL navigation
        logger.auger('No search input found, navigating directly to search URL');
        await page.waitForTimeout(2000); // Let session stabilize

        logger.auger('Navigating to: %s', searchUrl);
        await page.goto(searchUrl, {
          waitUntil: 'networkidle',
          timeout: 20000
        });
        logger.auger('Search page loaded');

        // Verify we're not bounced back to login
        const atLoginDom = Boolean(await page.$('#Login')) || Boolean(await page.$('input[name="emailAddress"]'));
        const atLoginUrl = page.url().toLowerCase().includes('/login');

        if (atLoginDom || atLoginUrl) {
          const currentUrl = page.url();
          logger.error('Still on login page after navigation. URL: %s, LoginForm: %s',
            currentUrl, atLoginDom ? 'Present' : 'Not Found');

          // Capture screenshot for debugging
          try {
            const screenshotPath = 'auger-login-failed.png';
            await page.screenshot({ path: screenshotPath });
            logger.auger('Login failure screenshot saved to: %s', screenshotPath);
          } catch (screenshotErr) {
            logger.error('Failed to save debug screenshot:', screenshotErr);
          }

          await context.close();
          throw new Error('LOGIN_FAILED: Still on login page after navigation');
        }

        // Wait for results using multiple selectors
        const resultSelectors = [
          '.product-item',
          'tr.product',
          '.search-result-item',
          '.product-list',
          '.search-results',
          'table.results'
        ];

        let resultsFound = false;
        for (const selector of resultSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            logger.auger('Found results with selector: %s', selector);
            resultsFound = true;
            break;
          } catch (e) {
            logger.debug('Selector not found: %s', selector);
          }
        }

        if (!resultsFound) {
          logger.warn('No results found with known selectors - page may still be loading');
        }

        // Final wait for any pending network activity
        await page.waitForLoadState('networkidle');

        // Get final page content
        const html = await page.content();
        const status = 200;  // If we got here, page loaded

        // Save debug screenshot if needed
        if (process.env.DEBUG) {
          await page.screenshot({ path: 'auger-results.png' });
          logger.debug('Saved debug screenshot as auger-results.png');
        }

        // Clean up
        await context.close();
        logger.auger('Search completed successfully');
        return { html, status };
      }

    } catch (e) {
      // Make sure we clean up even on error
      try {
        await context.close();
      } catch (closeError) {
        logger.error('Failed to close browser context:', closeError);
      }
      throw e;
    }

    const html = await page.content();
    const status = 200;  // Se chegamos aqui, a página carregou

    // Capturar screenshot para debug se necessário
    if (process.env.DEBUG) {
      await page.screenshot({ path: 'auger-results.png' });
    }

    await context.close();
    return { html, status };
  } catch(e) {
    await context.close();
    throw e;
  }
}
}
