import { Supplier, SupplierCredential } from '../types';
import { getBrowser } from '../providers/playwright';

type FetchResult = { html: string; status: number };

function isPlaywrightEnabled(): boolean {
  return process.env.ENABLE_PLAYWRIGHT_LOGIN === '1' || process.env.ENABLE_PLAYWRIGHT_LOGIN === 'true';
}

export async function fetchWithLogin(
  supplier: Supplier,
  credential: SupplierCredential,
  searchUrl: string,
  timeoutMs: number = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '20000', 10)
): Promise<FetchResult> {
  if (!isPlaywrightEnabled()) {
    throw new Error('PLAYWRIGHT_DISABLED');
  }

  let browser: any;
  try {
    browser = await getBrowser();
  } catch {
    throw new Error('PLAYWRIGHT_NOT_INSTALLED');
  }
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  try {
    // 1) Go to login URL
    await page.goto(credential.url, { waitUntil: 'domcontentloaded' });

    // Heuristic selectors for username/password
    const userSelectorCandidates = [
      'input[name="username"]', 'input[id*="user"]', 'input[name*="user"]', 'input[type="email"]', 'input[type="text"]'
    ];
    const passSelectorCandidates = [
      'input[name="password"]', 'input[id*="pass"]', 'input[name*="pass"]', 'input[type="password"]'
    ];
    const submitSelectorCandidates = [
      'button[type="submit"]', 'input[type="submit"]', 'button:has-text("Login")', 'button:has-text("Entrar")'
    ];

    let userSel: string | null = null;
    for (const sel of userSelectorCandidates) {
      if (await page.$(sel)) { userSel = sel; break; }
    }
    let passSel: string | null = null;
    for (const sel of passSelectorCandidates) {
      if (await page.$(sel)) { passSel = sel; break; }
    }
    let submitSel: string | null = null;
    for (const sel of submitSelectorCandidates) {
      if (await page.$(sel)) { submitSel = sel; break; }
    }

    if (!userSel || !passSel || !submitSel) {
      throw new Error('LOGIN_FORM_NOT_DETECTED');
    }

    await page.fill(userSel, credential.login);
    // Password is encrypted at rest; backend should decrypt before call when needed.
    // Here we expect plain string in credential.password.
    await page.fill(passSel, credential.password || '');
    await Promise.all([
      page.click(submitSel),
      page.waitForLoadState('networkidle'),
    ]);

    // 2) Navigate to search URL
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    const html = await page.content();
    await browser.close();
    return { html, status: 200 };
  } catch (err) {
    await context.close();
    throw err;
  }
}
