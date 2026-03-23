import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getBrowser, closeBrowser } from '../src/providers/playwright';

const LOGIN_URL = 'https://airfren.com/login';
const LOGIN = 'eurocomponentes@eurocomponentes.pt';
const PASSWORD = '20201999';
const QUERY = 'filtro';

async function save(html: string, label: string) {
  const p = path.resolve(process.cwd(), `tmp-airfren-${label}.html`);
  fs.writeFileSync(p, html, 'utf8');
  console.log('  [saved]', p);
}

async function main() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1366, height: 860 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,pt;q=0.8' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('\n[1] Login page:', LOGIN_URL);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

    // Dismiss cookie/privacy banner first if present
    const privacyBtn = page.locator('button:has-text("Acepto la política"), button:has-text("Acepto"), button:has-text("Aceptar")').first();
    if (await privacyBtn.isVisible().catch(() => false)) {
      console.log('    Dismissing privacy banner...');
      await privacyBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    console.log('\n[2] Filling credentials (using specific selectors)...');
    const emailInput = page.locator('#login-email, input[name="usuario"]').first();
    const pwInput = page.locator('#login-password, input[name="password"]').first();
    const loginBtn = page.locator('button:has-text("Login")').first();
    const rememberMe = page.locator('#remember_me').first();

    console.log('    email found:', await emailInput.count() > 0);
    console.log('    password found:', await pwInput.count() > 0);
    console.log('    login btn found:', await loginBtn.count() > 0);

    if (await rememberMe.count() > 0) {
      const checked = await rememberMe.isChecked().catch(() => false);
      if (!checked) { await rememberMe.click({ force: true }).catch(() => {}); console.log('    Ticked remember me'); }
    }

    await emailInput.fill(LOGIN);
    await pwInput.fill(PASSWORD);

    await Promise.all([
      loginBtn.click({ force: true }),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    ]);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    console.log('\n[3] Post-login URL:', page.url());
    await save(await page.content(), '2-post-login');

    // Check logged in: look for "Perfil" link or absence of login form
    const perfilCount = await page.locator('a:has-text("Perfil"), .icon-usuario + span').count().catch(() => 0);
    const loginFormVisible = await page.locator('input[name="usuario"]:visible').count().catch(() => 0);
    const nologinCards = await page.locator('.nologin').count().catch(() => 0);
    console.log('    Perfil link:', perfilCount);
    console.log('    Login form still visible:', loginFormVisible > 0);
    console.log('    nologin cards:', nologinCards);

    if (loginFormVisible > 0) {
      console.log('  ⚠ Login failed!');
      return;
    }
    console.log('  ✓ Logged in!');

    // Search
    console.log('\n[4] Navigating directly to search URL...');
    const searchUrl = `https://airfren.com/catalogo-productos?search=reference&q=${encodeURIComponent(QUERY)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    console.log('    URL:', page.url());
    await save(await page.content(), '3-search-results');

    const cards = await page.locator('.product-card').count();
    const nologin2 = await page.locator('.nologin').count();
    console.log('    product-card:', cards, '| nologin:', nologin2);

  } finally {
    await page.close();
    await context.close();
    await closeBrowser().catch(() => {});
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
