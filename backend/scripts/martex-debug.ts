import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== '0' && process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1366,860',
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto('https://sklep.martextruck.pl/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    await page.fill('input[name="ctl00$box_3$tbUserId"]', process.env.MARTEX_USER || 'EC01');
    await page.fill('input[name="ctl00$box_3$tbPassword"]', process.env.MARTEX_PASS || 'martex1234');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
      page.click('input[name="ctl00$box_3$btnLogin"]'),
    ]);

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const loggedLabel = await page.locator('text=/Logged/i').count();
    const polishLabel = await page.locator('text=/Zalogowan/i').count();
    const loginInputs = await page.locator('input[name="ctl00$box_3$tbUserId"]').count();
    const visibleLoginInputs = await page.locator('input[name="ctl00$box_3$tbUserId"]:visible').count();
    console.log('After login - logged label count:', loggedLabel);
    console.log('Polish logged label count:', polishLabel);
    console.log('Login inputs (all/visible):', loginInputs, '/', visibleLoginInputs);
    await page.screenshot({ path: 'martex-after-login.png', fullPage: true });

    await page.goto('https://sklep.martextruck.pl/partscatalogue/searchresult.aspx?search=364624', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('After search - logged label count:', await page.locator('text=/Logged/i').count());
    console.log('After search - Polish logged label count:', await page.locator('text=/Zalogowan/i').count());
    console.log('After search - login inputs visible:', await page.locator('input[name="ctl00$box_3$tbUserId"]:visible').count());
    await page.screenshot({ path: 'martex-search.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debug().catch((err) => {
  console.error(err);
  process.exit(1);
});
