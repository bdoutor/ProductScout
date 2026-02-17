const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1366, height: 860 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto('https://eurocomp.gsmart.eu/usuarios/log', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const usernameSelectors = ['#UsuarioUsername', 'input[name="data[Usuario][username]"]'];
  let usernameLocator;
  for (const sel of usernameSelectors) {
    const locator = page.locator(sel).first();
    if (await locator.count().catch(() => 0)) {
      usernameLocator = locator;
      break;
    }
  }
  if (!usernameLocator) throw new Error('Username input not found');
  const passwordLocator = page.locator('#UsuarioPassword').first();
  await usernameLocator.fill('valdemar craveiro');
  await passwordLocator.fill('Euro1999');
  await page.waitForTimeout(1000);
  await Promise.all([
    page.click('#UsuarioLoginForm input[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {})
  ]);
  await page.waitForTimeout(4000);
  await page.goto('https://eurocomp.gsmart.eu/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(4000);
  let searchInput = page.locator('#producto-busqueda-js').first();
  if (!(await searchInput.count())) {
    searchInput = page.locator('input[placeholder*="refer"]', { hasText: undefined }).first();
  }
  await searchInput.fill('364624');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6000);
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('gsmart-after-search.html', html);
  await browser.close();
})();
