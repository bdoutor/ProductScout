// Auger demo run: open login, fill credentials, login and search for given query
// Usage: AUGER_USER=... AUGER_PASS=... node backend/scripts/auger-demo.js --query "filtro" --hold 45

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // ms

// Session cache configuration
const SESSION_CACHE_FILE = path.join(__dirname, '.session-cache.json');
const SESSION_MAX_AGE = 1000 * 60 * 60; // 1 hour

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

const QUERY = arg('query', 'filtro');
const HOLD = parseInt(arg('hold', '45'), 10); // seconds to hold at end for filming
// Helper function to manage session cache
function loadSessionCache() {
  try {
    if (fs.existsSync(SESSION_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(SESSION_CACHE_FILE, 'utf8'));
      if (Date.now() - cache.timestamp < SESSION_MAX_AGE) {
        return cache.cookies;
      }
    }
  } catch (err) {
    console.warn('Failed to load session cache:', err);
  }
  return null;
}

function saveSessionCache(cookies) {
  try {
    fs.writeFileSync(SESSION_CACHE_FILE, JSON.stringify({
      timestamp: Date.now(),
      cookies
    }));
  } catch (err) {
    console.warn('Failed to save session cache:', err);
  }
}

// Helper function for retrying operations
async function withRetry(operation, context = '') {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log(`Succeeded on attempt ${attempt}${context ? ' for ' + context : ''}`);
      }
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed${context ? ' for ' + context : ''}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  throw lastError;
}

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
    } catch { }
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

let USER = process.env.AUGER_USER || fallback.AUGER_USER || '';
let PASS = process.env.AUGER_PASS || fallback.AUGER_PASS || '';

const LOGIN_URL = 'https://portal.iamauger.com/login';

async function run() {
  if (!USER || !PASS) {
    const fetched = await withRetry(fetchAugerCreds, 'fetching credentials');
    USER = USER || fetched.user;
    PASS = PASS || fetched.pass;
  }
  if (!USER || !PASS) {
    console.error('Auger credentials not found in Supabase.');
    process.exit(2);
  }
  const headless = false;
  const browser = await chromium.launch({
    headless,
    slowMo: 200,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--window-size=1366,860'
    ]
  });

  // Try to restore session from cache
  const cachedCookies = loadSessionCache();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 860 },
    storageState: cachedCookies ? { cookies: cachedCookies } : undefined
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  async function performLogin() {
    console.log('1. Opening login page...');
    await withRetry(() => page.goto(LOGIN_URL, { waitUntil: 'networkidle' }), 'opening login page');

    // Verify we're on the login page
    await withRetry(async () => {
      await page.waitForSelector('#Login', { state: 'visible' });
      console.log('Login form found');
    }, 'verifying login page loaded');

    // Close overlay if present
    try {
      const btn = await page.$('.modalOverlay .close, button.close');
      if (btn) {
        console.log('Modal overlay found, closing...');
        await btn.click({ force: true });
      }
    } catch { }

    console.log('2. Filling credentials...');
    await withRetry(async () => {
      // Wait for email input and ensure it's visible and enabled
      const emailInput = await page.waitForSelector('input[name="emailAddress"]', {
        state: 'visible',
        timeout: 10000
      });

      // Ensure input is ready for interaction
      await emailInput.waitForElementState('stable');
      await emailInput.waitForElementState('enabled');

      // Clear and fill email
      await emailInput.click();
      await emailInput.fill('');
      await page.type('input[name="emailAddress"]', USER, { delay: 60 });

      // Similar approach for password
      const passInput = await page.waitForSelector('input[name="password"]', {
        state: 'visible',
        timeout: 10000
      });

      await passInput.waitForElementState('stable');
      await passInput.waitForElementState('enabled');

      await passInput.click();
      await passInput.fill('');
      await page.type('input[name="password"]', PASS, { delay: 60 });
    }, 'filling credentials');

    console.log('3. Submitting login...');
    try { await page.click('.btn-login', { force: true }); } catch { }

    console.log('4. Waiting for login success...');
    await withRetry(() => Promise.race([
      // Wait until the login form is gone
      page.waitForSelector('#Login', { state: 'detached', timeout: 10000 }),
      // OR wait until we're redirected away from login page 
      page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 }),
      // OR wait until user menu appears
      page.waitForSelector('header .user-menu', { timeout: 10000 })
    ]), 'waiting for login success');

    // Save successful session
    const cookies = await context.cookies();
    saveSessionCache(cookies);
  }

  // Try to verify if we're already logged in first
  let needsLogin = true;
  try {
    await page.goto('https://portal.iamauger.com/search', { timeout: 5000 });
    if (await page.$('header .user-menu')) {
      console.log('Using cached session');
      needsLogin = false;
    }
  } catch { }

  if (needsLogin) {
    await performLogin();
  }

  console.log('4b. Validating login state...');
  await page.waitForTimeout(5000);

  console.log('5. Navigating to search...');
  await withRetry(async () => {
    console.log('   Going directly to search page...');
    await page.goto('https://portal.iamauger.com/search', { waitUntil: 'networkidle' });

    // Espera mais tempo para garantir que a página carregou completamente
    console.log('   Waiting for page to settle...');
    await page.waitForTimeout(5000);

    // Espera a página carregar completamente
    await page.waitForLoadState('networkidle');

    // Procura o input de busca através de uma análise do DOM
    console.log('   Analyzing page structure to find search input...');
    const searchInput = await page.evaluateHandle(() => {
      // Função auxiliar para checar se um elemento é visível
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };

      // Procura por todos os inputs visíveis
      const inputs = Array.from(document.querySelectorAll('input')).filter(input => {
        return isVisible(input) && !input.disabled && (
          input.type === 'text' ||
          input.type === 'search' ||
          input.type === ''
        );
      });

      // Tenta encontrar o input de busca por diferentes critérios
      return inputs.find(input => {
        const inputData = {
          type: input.type.toLowerCase(),
          placeholder: (input.placeholder || '').toLowerCase(),
          name: (input.name || '').toLowerCase(),
          id: (input.id || '').toLowerCase(),
          ariaLabel: (input.getAttribute('aria-label') || '').toLowerCase(),
          classes: Array.from(input.classList).join(' ').toLowerCase(),
          parentText: (input.parentElement?.textContent || '').toLowerCase()
        };

        return (
          inputData.type === 'search' ||
          inputData.placeholder.includes('search') ||
          inputData.placeholder.includes('pesquisa') ||
          inputData.name.includes('search') ||
          inputData.name.includes('pesquisa') ||
          inputData.id.includes('search') ||
          inputData.id.includes('pesquisa') ||
          inputData.ariaLabel.includes('search') ||
          inputData.ariaLabel.includes('pesquisa') ||
          inputData.classes.includes('search') ||
          inputData.parentText.includes('search') ||
          inputData.parentText.includes('pesquisa')
        );
      }) || inputs[0]; // Se não encontrar por critérios, pega o primeiro input visível
    });

    if (searchInput) {
      console.log('   Found potential search input');
    }

    if (!searchInput) {
      // Se não encontrou pelos seletores, tenta buscar por texto
      console.log('   Trying to find by text content...');
      const textQueries = ['Search', 'Pesquisar', 'Buscar', 'Procurar'];
      for (const text of textQueries) {
        try {
          const element = await page.getByText(text, { exact: false }).first();
          if (element) {
            await element.click();
            searchInput = await page.$('input:focus');
            if (searchInput) {
              console.log(`   Found search input by text: ${text}`);
              break;
            }
          }
        } catch (e) {
          console.log(`   Text "${text}" not found`);
        }
      }
    }

    if (!searchInput) {
      throw new Error('Search input not found');
    }

    console.log('   Clicking search input...');
    await searchInput.click();
    await page.waitForTimeout(500);

    console.log('   Entering search query...');
    await searchInput.fill(QUERY);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');

    console.log('   Waiting for results page update...');
    await Promise.race([
      page.waitForURL(url => url.toString().includes('/search'), { timeout: 15000 }),
      page.waitForSelector('.search-results-box, .results-container, [class*="search-results"], [class*="product-list"]', {
        state: 'visible',
        timeout: 15000
      })
    ]);
  }, 'navigating to search');

  console.log('6. Waiting for results...');
  await withRetry(async () => {
    console.log('   Taking pre-search screenshot...');
    await page.screenshot({ path: 'before-results.png' });

    try {
      console.log('   Waiting for initial page load...');
      await page.waitForTimeout(5000); // Wait for page to settle

      console.log('   Checking search results...');
      const hasContent = await page.evaluate(() => {
        // Try multiple possible selectors for results container
        const containers = [
          document.querySelector('div.search-results-box'),
          document.querySelector('div.results-container'),
          document.querySelector('div[class*="search-results"]'),
          document.querySelector('div[class*="product-list"]')
        ].filter(Boolean);

        // Look for product links or cards
        const results = [
          document.querySelector('a[href*="product-detail"]'),
          document.querySelector('div[class*="product-card"]'),
          document.querySelector('div[class*="search-item"]')
        ].filter(Boolean);

        // Check for no results message
        const noResults = [
          document.querySelector('.no-results'),
          document.querySelector('div[class*="no-results"]'),
          // Find divs that contain the "No results found" text
          ...Array.from(document.querySelectorAll('div')).filter(div =>
            div.textContent.includes('No results found')
          )
        ].filter(Boolean);

        return {
          hasContainer: containers.length > 0,
          containers: containers.map(el => el.className),
          hasResults: results.length > 0,
          results: results.map(el => el.className || el.href),
          hasNoResults: noResults.length > 0,
          noResults: noResults.map(el => el.className)
        };
      });

      console.log('Search content check:', JSON.stringify(hasContent, null, 2));

      if (!hasContent.hasContainer && !hasContent.hasResults) {
        console.log('Taking debug screenshot...');
        await page.screenshot({ path: 'search-debug.png' });
        throw new Error('Search results container not found');
      }

      if (!hasContent.hasResults && !hasContent.hasNoResults) {
        throw new Error('Neither results nor no-results message found');
      }

      // Verify we actually have the expected content if results were found
      if (hasContent.hasResults) {
        const resultsCheck = await page.$$('.custom-link');
        console.log(`   Found ${resultsCheck.length} product links`);

        if (resultsCheck.length === 0) {
          throw new Error('Results verification failed - no product links found');
        }
      }

    } catch (err) {
      console.log('Error during results check:', err.message);
      console.log('Taking error screenshot...');
      await page.screenshot({ path: 'search-timeout.png' });
      throw err;
    }

    console.log('   Taking final results screenshot...');
    await page.screenshot({ path: 'after-results.png' });
  }, 'waiting for search results');

  // Wait for any additional loading
  await page.waitForTimeout(2000);

  console.log('7. Scrolling to reveal more items...');
  await withRetry(async () => {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);

    // Try to make sure we have results
    const results = await page.$$('.custom-link');
    console.log(`Found ${results.length} product results`);

    // Throw error if no results found to trigger retry
    if (results.length === 0) {
      throw new Error('No results found, may need to retry');
    }
  }, 'loading all results');

  console.log('8. Holding screen for filming...');
  await page.waitForTimeout(HOLD * 1000);

  await context.close();
  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
