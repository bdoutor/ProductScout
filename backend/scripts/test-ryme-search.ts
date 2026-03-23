import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getBrowser, closeBrowser } from '../src/providers/playwright';
import { loadSessionCache } from '../src/utils/session-cache';

const BASE_URL = 'https://b2b.rymeautomotive.com/pt';
const CACHE_KEY = 'ryme-f55d22e8-ed81-495c-ab15-e629759f8646';

async function main() {
  const cachedCookies = loadSessionCache(CACHE_KEY);
  if (!cachedCookies) { console.error('No cached session!'); process.exit(1); }

  const browser = await getBrowser();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1366, height: 860 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    storageState: { cookies: cachedCookies },
    extraHTTPHeaders: { 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('\n[1] Going to home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('    URL:', page.url());

    // Find search input
    const searchInputs = await page.locator('input').evaluateAll((els: any[]) =>
      els.map(e => ({ name: e.name, placeholder: e.placeholder, type: e.type, visible: !e.hidden }))
    );
    console.log('\n[2] All inputs:', JSON.stringify(searchInputs, null, 2));

    // Try to type in search
    const searchInput = page.locator('input[name="search-top"]').first();
    if (await searchInput.count() > 0) {
      console.log('\n[3] Typing "filtro" in search-top input...');
      await searchInput.click();
      await page.waitForTimeout(500);
      await searchInput.fill('filtro');
      await page.waitForTimeout(500);
      console.log('    Pressing Enter...');
      await searchInput.press('Enter');
      // Wait for navigation
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      console.log('\n[4] URL after search:', page.url());
      const html = await page.content();
      fs.writeFileSync(path.resolve(process.cwd(), 'tmp-ryme-search-result.html'), html, 'utf8');
      console.log('    HTML length:', html.length);
      
      // Check for products
      const filtroCount = html.toLowerCase().split('filtro').length - 1;
      console.log('    "filtro" occurrences:', filtroCount);
      const productCards = (html.match(/product-card/g) || []).length;
      console.log('    product-card occurrences:', productCards);
      
      // Check all buttons visible
      const buttons = await page.locator('button').evaluateAll((els: any[]) =>
        els.filter(e => e.offsetParent !== null).map(e => ({ type: e.type, text: e.textContent?.trim().substring(0, 30) }))
      );
      console.log('\n[5] Visible buttons:', JSON.stringify(buttons.slice(0, 10), null, 2));
    }
  } finally {
    await page.close();
    await context.close();
    await closeBrowser().catch(() => {});
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
