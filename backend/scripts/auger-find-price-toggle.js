// Diagnostic: find and test the "Preço -> Mostrar" toggle selectors on Auger
// Usage: AUGER_USER=... AUGER_PASS=... node backend/scripts/auger-find-price-toggle.js --query "364624" --headless 0

const { chromium } = require('playwright');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

const QUERY = arg('query', '364624');
const HEADLESS = arg('headless', '1') !== '0';
const LOGIN_URL = 'https://portal.iamauger.com/login';
const SEARCH_URL = (q) => `https://portal.iamauger.com/search?keyword=${encodeURIComponent(q)}&searchType=0&itemsPerPage=25&page=1`;

function short(el) {
  const t = (el.textContent || '').trim();
  return t.length > 60 ? t.slice(0, 57) + '...' : t;
}

function cssPath(el) {
  if (!(el instanceof Element)) return '';
  const path = [];
  while (el && el.nodeType === 1 && path.length < 6) {
    let sel = el.nodeName.toLowerCase();
    if (el.id) { sel += `#${el.id}`; path.unshift(sel); break; }
    let sib = el, nth = 1;
    while (sib = sib.previousElementSibling) if (sib.nodeName === el.nodeName) nth++;
    sel += `:nth-of-type(${nth})`;
    if (el.className && typeof el.className === 'string') {
      const c = el.className.trim().split(/\s+/).slice(0,2).join('.');
      if (c) sel += `.${c}`;
    }
    path.unshift(sel);
    el = el.parentElement;
  }
  return path.join(' > ');
}

async function main() {
  const user = process.env.AUGER_USER;
  const pass = process.env.AUGER_PASS;
  if (!user || !pass) {
    console.error('Missing AUGER_USER/AUGER_PASS');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: HEADLESS, args: ['--disable-blink-features=AutomationControlled','--no-sandbox','--window-size=1366,860'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  try { const c = await page.$('.modalOverlay .close, button.close'); if (c) await c.click({ force: true }); } catch {}
  await page.fill('input[name="emailAddress"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click('.btn-login');
  await Promise.race([
    page.waitForSelector('#Login', { state: 'detached' }),
    page.waitForTimeout(8000),
  ]);

  await page.goto(SEARCH_URL(QUERY), { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('a[href*="product-detail"]', { timeout: 15000 }); } catch {}

  // Collect candidate elements by text
  const candidates = await page.evaluate(() => {
    const out = [];
    const texts = ['Preço', 'Mostrar'];
    const all = Array.from(document.querySelectorAll('button, a, [role="button"], .header-full *'));
    for (const el of all) {
      const t = (el.textContent||'').trim();
      if (!t) continue;
      if (texts.some(x => t.toLowerCase().includes(x.toLowerCase()))) {
        out.push({ text: t, tag: el.tagName.toLowerCase(), path: (el.id ? `#${el.id}` : '') });
      }
    }
    return out.slice(0, 50);
  });

  // Try known selectors
  const trySelectors = [
    'text=Preço',
    'button:has-text("Preço")',
    'button:has-text("Mostrar")',
    'text=Mostrar',
    'span:has-text("Preço")',
    'span:has-text("Mostrar")',
  ];

  const results = [];
  for (const sel of trySelectors) {
    try {
      const el = await page.$(sel);
      const ok = !!el;
      results.push({ selector: sel, found: ok });
      if (el) {
        await el.click({ force: true });
        await page.waitForTimeout(400);
      }
    } catch (e) {
      results.push({ selector: sel, found: false, error: e.message });
    }
  }

  // Final verification: do we see visible prices next to cards?
  const visiblePriceSamples = await page.evaluate(() => {
    const arr = [];
    const cards = Array.from(document.querySelectorAll('.product, .product-item, .product-card'));
    for (const c of cards.slice(0,5)) {
      const p = c.querySelector('.price, .product-price, [class*="price" i]');
      if (p && (p.textContent||'').trim()) arr.push((p.textContent||'').trim());
    }
    return arr;
  });

  console.log(JSON.stringify({ candidates, tryResults: results, priceSamples: visiblePriceSamples }, null, 2));

  // Hold window for manual inspection if headful
  if (!HEADLESS) await page.waitForTimeout(15000);
  await ctx.close();
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });

