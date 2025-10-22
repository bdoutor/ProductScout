// Auger step-by-step runner with screenshots and HTML snapshots
// Usage:
//   AUGER_USER=... AUGER_PASS=... node backend/scripts/auger-stepper.js --step 1 --query "filtro" --headless 0

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

const STEP = parseInt(arg('step', '1'), 10);
const QUERY = arg('query', 'filtro');
const HEADLESS = arg('headless', process.env.PLAYWRIGHT_HEADLESS || '1') !== '0';
const OUT_ROOT = path.join(process.cwd(), 'logs', 'evidence', 'auger');
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(OUT_ROOT, TS);
const LOGIN_URL = 'https://portal.iamauger.com/login';
const SEARCH_URL = `https://portal.iamauger.com/search?keyword=${encodeURIComponent(QUERY)}&searchType=0&itemsPerPage=25&page=1`;

function loadEnvFallback() {
  try {
    const p = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(p)) return {};
    const txt = fs.readFileSync(p, 'utf8');
    const out = {};
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) out[m[1].trim()] = m[2].trim();
    }
    return out;
  } catch { return {}; }
}
const fallback = loadEnvFallback();

function getSupabase() {
  const url = process.env.SUPABASE_URL || fallback.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || fallback.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || fallback.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getEncKey() {
  const envKey = process.env.SUPPLIER_CREDS_ENC_KEY || fallback.SUPPLIER_CREDS_ENC_KEY;
  if (envKey) {
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(envKey)) {
        const b = Buffer.from(envKey, 'base64');
        if (b.length === 32) return b;
      }
      const hex = Buffer.from(envKey, 'hex');
      if (hex.length === 32) return hex;
    } catch {}
  }
  const base = process.env.SESSION_SECRET || fallback.SESSION_SECRET || 'change-me-dev';
  return crypto.createHash('sha256').update(base).digest();
}

function decryptPassword(stored) {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored;
  const KEY = getEncKey();
  const buf = Buffer.from(stored.slice(4), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

async function fetchAugerCreds() {
  const sb = getSupabase();
  if (!sb) return { user: '', pass: '' };
  const { data, error } = await sb
    .from('supplier_credentials')
    .select('*')
    .eq('name', 'AUGER')
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return { user: '', pass: '' };
  return { user: String(data.login || ''), pass: decryptPassword(String(data.password || '')) };
}

async function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function saveHtml(page, name) {
  const file = path.join(OUT_DIR, name);
  const html = await page.content();
  fs.writeFileSync(file, html, 'utf8');
  return file;
}

async function clickCookiesAndOverlays(page) {
  const cookieButtons = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Accept")',
    'button:has-text("Aceitar")',
    'button[aria-label*="accept" i]'
  ];
  for (const sel of cookieButtons) {
    const el = await page.$(sel);
    if (el) { try { await el.click({ force: true }); await page.waitForTimeout(300); } catch {} }
  }
  const overlays = ['.modalOverlay .close', 'button.close', '.modalOverlay'];
  for (const sel of overlays) {
    const el = await page.$(sel);
    if (el) { try { await el.click({ force: true }); await page.waitForTimeout(300); } catch {} }
  }
}

async function findAndFill(page, selectors, value) {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      try {
        await el.click({ delay: 20 });
        await page.fill(sel, '');
        await page.type(sel, value, { delay: 35 });
        return true;
      } catch {}
    }
  }
  return false;
}

async function main() {
  // Resolve credentials: prefer env, else Supabase
  let USER = process.env.AUGER_USER || fallback.AUGER_USER || '';
  let PASS = process.env.AUGER_PASS || fallback.AUGER_PASS || '';
  if (!USER || !PASS) {
    const fetched = await fetchAugerCreds();
    USER = USER || fetched.user;
    PASS = PASS || fetched.pass;
  }
  if (!USER || !PASS) {
    console.error('Auger credentials not found. Ensure supplier_credentials has an active AUGER row.');
    process.exit(2);
  }

  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: HEADLESS, args: ['--disable-blink-features=AutomationControlled','--no-sandbox','--disable-dev-shm-usage','--window-size=1366,860'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  let output = { step: STEP, dir: OUT_DIR, query: QUERY, artifacts: [] };

  try {
    if (STEP === 1) {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await clickCookiesAndOverlays(page);
      output.artifacts.push(await shot(page, 'step1-login.png'));
      output.artifacts.push(await saveHtml(page, 'step1-login.html'));
    } else if (STEP === 2) {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await clickCookiesAndOverlays(page);
      const userSelectors = [
        'input[name="emailAddress"]',
        'input[type="email"]',
        'input[name*="user" i]',
        '#username', '#email', 'input[type="text"]'
      ];
      const passSelectors = [
        'input[name="password"]', 'input[type="password"]', '#password'
      ];
      const okUser = await findAndFill(page, userSelectors, USER);
      const okPass = await findAndFill(page, passSelectors, PASS);
      if (!okUser || !okPass) {
        output.error = 'Login inputs not found';
      }
      output.artifacts.push(await shot(page, 'step2-filled.png'));
    } else if (STEP === 3) {
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await clickCookiesAndOverlays(page);
      await findAndFill(page, ['input[name="emailAddress"]','input[type="email"]','input[name*="user" i]','#username','#email','input[type="text"]'], USER);
      await findAndFill(page, ['input[name="password"]','input[type="password"]','#password'], PASS);
      // Submit and wait
      try {
        await page.click('.btn-login', { force: true });
      } catch {}
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.waitForTimeout(4000),
      ]);
      // Fallback 1: press Enter on password
      let stillLogin = await page.$('#Login');
      if (stillLogin) {
        try {
          await page.keyboard.press('Enter');
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            page.waitForTimeout(3000),
          ]);
        } catch {}
      }
      // Fallback 2: form submit via JS
      stillLogin = await page.$('#Login');
      if (stillLogin) {
        try {
          await page.evaluate(() => {
            const f = document.querySelector('form');
            if (f) (f as HTMLFormElement).submit();
          });
          await page.waitForTimeout(1500);
        } catch {}
      }
      // Check login success
      stillLogin = await page.$('#Login');
      output.login_ok = !stillLogin;
      output.artifacts.push(await shot(page, 'step3-after-submit.png'));
      output.artifacts.push(await saveHtml(page, 'step3-after-submit.html'));
    } else if (STEP === 4) {
      // Assume logged in (run step 3 first). Navigate to search
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await clickCookiesAndOverlays(page);
      await findAndFill(page, ['input[name="emailAddress"]','input[type="email"]','input[name*="user" i]','#username','#email','input[type="text"]'], USER);
      await findAndFill(page, ['input[name="password"]','input[type="password"]','#password'], PASS);
      try { await page.click('.btn-login', { force: true }); } catch {}
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.waitForTimeout(4000),
      ]);
      // Fallbacks
      let still = await page.$('#Login');
      if (still) {
        try { await page.keyboard.press('Enter'); await Promise.race([page.waitForNavigation({ waitUntil:'domcontentloaded' }), page.waitForTimeout(3000)]);} catch {}
      }
      still = await page.$('#Login');
      if (still) {
        try { await page.evaluate(() => { const f = document.querySelector('form'); if (f) (f as HTMLFormElement).submit(); }); await page.waitForTimeout(1500);} catch {}
      }
      // Go to search URL
      await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      output.url = page.url();
      output.artifacts.push(await shot(page, 'step4-search.png'));
      output.artifacts.push(await saveHtml(page, 'step4-search.html'));
      // Try basic selectors
      const items = await page.locator('.product-item').count();
      output.items_guess = items;
    } else if (STEP === 5) {
      // End-to-end: login, search, extract items heuristically
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      try { const c = await page.$('.modalOverlay .close, button.close'); if (c) await c.click({ force: true }); } catch {}
      await page.fill('input[name="emailAddress"]', USER);
      await page.fill('input[name="password"]', PASS);
      try { await page.click('.btn-login', { force: true }); } catch {}
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.waitForTimeout(5000),
      ]);
      // sanity: ensure not on login
      const stillLogin = await page.$('#Login');
      output.login_ok = !stillLogin;
      await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded' });
      // Wait for likely product links to appear
      try { await page.waitForSelector('a[href*="product-detail"]', { timeout: 15000 }); } catch {}
      await page.waitForTimeout(2000);
      output.url = page.url();
      const items = await page.evaluate(() => {
        function abs(u){ try{ const a=document.createElement('a'); a.href=u; return a.href; } catch{return u} }
        const links = Array.from(document.querySelectorAll('a[href*="product-detail"]'));
        const out = [];
        for (const a of links) {
          const name = (a.textContent||'').trim();
          let price = null;
          const priceNode = a.closest('*')?.querySelector?.('.price, .product-price, [class*="price" i]');
          if (priceNode) price = priceNode.textContent.trim();
          out.push({ name, url: abs(a.getAttribute('href')||''), price });
        }
        return out;
      });
      output.items = items;
      output.items_count = items.length;
      output.artifacts.push(await shot(page, 'step5-extract.png'));
      output.artifacts.push(await saveHtml(page, 'step5-extract.html'));
    } else if (STEP === 6) {
      // End-to-end with price from detail pages (first N)
      const N = parseInt(arg('limit', '10'), 10);
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      try { const c = await page.$('.modalOverlay .close, button.close'); if (c) await c.click({ force: true }); } catch {}
      await page.fill('input[name="emailAddress"]', USER);
      await page.fill('input[name="password"]', PASS);
      try { await page.click('.btn-login', { force: true }); } catch {}
      await Promise.race([
        page.waitForSelector('#Login', { state: 'detached' }),
        page.waitForTimeout(8000),
      ]);
      const searchUrl = `https://portal.iamauger.com/search?keyword=${encodeURIComponent(QUERY)}&searchType=0&itemsPerPage=25&page=1`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      try { await page.waitForSelector('a[href*="product-detail"]', { timeout: 20000 }); } catch {}
      const links = await page.$$eval('a[href*="product-detail"]', as => Array.from(new Set(as.map(a => (a).getAttribute('href')||'').filter(Boolean))));
      const pick = links.slice(0, N);
      const results = [];
      for (const href of pick) {
        const url = new URL(href, 'https://portal.iamauger.com').href;
        const tab = await context.newPage();
        tab.setDefaultTimeout(40000);
        await tab.goto(url, { waitUntil: 'domcontentloaded' });
        try { await tab.waitForSelector('.price, .product-price, [class*="price" i]', { timeout: 8000 }); } catch {}
        const data = await tab.evaluate(() => {
          const title = document.querySelector('h1, .product-title, .detail-title');
          const priceEl = document.querySelector('.price, .product-price, [class*="price" i]');
          const stockEl = document.querySelector('[class*="stock" i], [class*="estoque" i], [class*="unidade" i]');
          return {
            name: (title?.textContent||'').trim() || document.title || '',
            price: (priceEl?.textContent||'').trim() || null,
            availability: (stockEl?.textContent||'').trim() || null,
          };
        });
        await tab.close();
        results.push({ url, ...data });
      }
      output.detail_count = results.length;
      output.detail_items = results;
      output.artifacts.push(await shot(page, 'step6-list.png'));
      output.artifacts.push(await saveHtml(page, 'step6-list.html'));
    } else {
      throw new Error('Unknown step');
    }
  } catch (e) {
    output.error = e.message || String(e);
  } finally {
    await context.close();
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, `step${STEP}-result.json`), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
