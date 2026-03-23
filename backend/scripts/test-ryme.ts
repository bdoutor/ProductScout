import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getBrowser, closeBrowser } from '../src/providers/playwright';

const LOGIN_URL = 'https://b2b.rymeautomotive.com/pt/login';
const BASE_URL = 'https://b2b.rymeautomotive.com/pt';
const LOGIN = '77141-00';
const PASSWORD = 'AuTz93';
const QUERY = 'filtro';

async function saveHtml(html: string, label: string) {
  const p = path.resolve(process.cwd(), `tmp-ryme-${label}.html`);
  fs.writeFileSync(p, html, 'utf8');
  console.log(`  [saved] ${p}`);
}

async function main() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1366, height: 860 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // 1. Navigate to login page
    console.log('\n[1] Navigating to login page:', LOGIN_URL);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    console.log('    URL after nav:', page.url());
    await saveHtml(await page.content(), '1-login-page');

    // 2. Inspect form fields
    console.log('\n[2] Inspecting form fields...');
    const allInputs = await page.locator('input').evaluateAll((els: any[]) =>
      els.map((el) => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder }))
    );
    console.log('    Inputs:', JSON.stringify(allInputs, null, 2));
    const allButtons = await page.locator('button').evaluateAll((els: any[]) =>
      els.map((el) => ({ type: el.type, text: el.textContent?.trim() }))
    );
    console.log('    Buttons:', JSON.stringify(allButtons, null, 2));

    // 3. Fill and submit
    console.log('\n[3] Filling credentials...');
    const usernameInput = page.locator('input[type="text"], input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();

    await usernameInput.fill(LOGIN);
    await passwordInput.fill(PASSWORD);

    // Tick "remember me" if present
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.count() > 0) {
      const checked = await checkbox.isChecked().catch(() => false);
      if (!checked) {
        await checkbox.click({ force: true }).catch(() => {});
        console.log('    Ticked remember-me checkbox');
      }
    }

    console.log('    Submitting...');
    await Promise.all([
      submitBtn.click({ force: true }),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    ]);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    console.log('\n[4] Post-login state:');
    console.log('    URL:', page.url());
    const postLoginHtml = await page.content();
    await saveHtml(postLoginHtml, '2-post-login');

    // 5. Check for search input
    const searchInputCount = await page.locator('input[placeholder*="Referência" i], input[placeholder*="Referencia" i], input[placeholder*="descrição" i], input[type="search"]').count();
    console.log('    Search input found:', searchInputCount > 0);

    const loginFormCount = await page.locator('input[type="password"]:visible').count();
    console.log('    Login form still visible:', loginFormCount > 0);

    // 6. All inputs on post-login page
    const postInputs = await page.locator('input').evaluateAll((els: any[]) =>
      els.map((el) => ({ type: el.type, name: el.name, placeholder: el.placeholder }))
    );
    console.log('    Inputs on page:', JSON.stringify(postInputs, null, 2));

    if (loginFormCount > 0) {
      console.log('\n  ⚠ Still on login page — login may have failed or form not submitted correctly');
    } else if (searchInputCount > 0) {
      console.log('\n  ✓ Logged in! Search input found.');

      // 7. Try search
      console.log('\n[5] Searching for:', QUERY);
      const searchInput = page.locator('input[placeholder*="Referência" i], input[placeholder*="Referencia" i], input[placeholder*="descrição" i], input[type="search"]').first();
      await searchInput.fill(QUERY);
      const searchBtn = page.locator('button:has-text("BUSCAR"), button:has-text("Buscar"), button[type="submit"]').first();
      if (await searchBtn.count() > 0) {
        await Promise.all([
          searchBtn.click({ force: true }),
          page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
        ]);
      } else {
        await searchInput.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      }
      await page.waitForTimeout(1000);
      console.log('    URL after search:', page.url());
      await saveHtml(await page.content(), '3-search-results');
      console.log('  Search HTML saved — verificar seletores nos resultados');
    } else {
      console.log('\n  ? Unknown state — ver HTML guardado');
    }

  } finally {
    await page.close();
    await context.close();
    await closeBrowser().catch(() => {});
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
