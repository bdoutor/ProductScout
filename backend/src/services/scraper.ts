import axios, { AxiosError } from 'axios';
import { Supplier, ProductItem, SearchRun, ErrorType } from '../types';
import { parseHtml, isBlockedByRobot, parsePrice, parseAvailability, extractAbsoluteUrl } from '../utils/parser';
import { supabase } from '../utils/supabase';
import { looksLikeRobotBlock } from '../utils/fetch-helpers';
import { decryptPassword } from '../utils/secrets';
import { getBrowser } from '../providers/playwright';

/**
 * Fetch page using HTTP mode
 */
async function fetchHttp(url: string, timeout: number = 10000): Promise<{ html: string; status: number }> {
  const response = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 500 // Accept client errors
  });

  return {
    html: response.data,
    status: response.status
  };
}

/**
 * Fetch page using render/crawl mode (Firecrawl or similar)
 */
async function fetchRender(url: string, timeout: number = 20000, waitTime: number = 2000): Promise<{ html: string; status: number }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured for render mode');
  }

  // Firecrawl scrape API with increased wait time for JS-heavy sites
  const response = await axios.post(
    'https://api.firecrawl.dev/v0/scrape',
    {
      url,
      pageOptions: {
        onlyMainContent: false,
        includeHtml: true,
        waitFor: waitTime // Wait for JS to load (default 3.5s)
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Firecrawl scrape failed');
  }

  return {
    html: response.data.data.html || response.data.data.content || '',
    status: 200
  };
}

/**
 * Store debug snapshot in Supabase Storage
 */
async function storeDebugSnapshot(runId: string, html: string): Promise<string | null> {
  try {
    const fileName = `search-runs/${runId}/results.html`;
    const { data, error } = await supabase.storage
      .from('debug-snapshots')
      .upload(fileName, html, {
        contentType: 'text/html',
        upsert: true
      });

    if (error) {
      console.error('Failed to upload debug snapshot:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('debug-snapshots')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Error storing debug snapshot:', err);
    return null;
  }
}

/**
 * Classify error type
 */
function classifyError(error: any): { type: ErrorType; message: string } {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNREFUSED') {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: `Network error: ${axiosError.message}`
      };
    }

    if (axiosError.response) {
      return {
        type: ErrorType.HTTP_ERROR,
        message: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
      };
    }
  }

  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: error.message || 'Unknown error occurred'
  };
}

/**
 * Scrape a single supplier for the given query
 */
export async function scrapeSupplier(
  supplier: Supplier,
  query: string,
  debug: boolean = false
): Promise<{ items: ProductItem[]; searchRun: SearchRun }> {
  const startTime = Date.now();
  const searchUrl = supplier.search_url_template.replace('{query}', encodeURIComponent(query));

  const searchRun: SearchRun = {
    reference: query,
    supplier_id: supplier.id,
    status: 'running',
    engine: supplier.mode,
    search_url_effective: searchUrl
  };

  let html = '';
  let httpStatus: number | null = null;
  let items: ProductItem[] = [];
  let itemsPrefetched: ProductItem[] | null = null;

  try {
    // Step 1: Fetch page
    const searchStart = Date.now();
    const fetchTimeout = supplier.timeouts?.search || (supplier.mode === 'http' ? 10000 : 15000);

    let fetchResult: { html: string; status: number };
    let usedRenderFallback = false;

    if (supplier.mode === 'http') {
      // Try HTTP first
      fetchResult = await fetchHttp(searchUrl, fetchTimeout);
      html = fetchResult.html;
      httpStatus = fetchResult.status;

      // Check if it looks like we're being blocked
      if (looksLikeRobotBlock(html) || isBlockedByRobot(html)) {
        console.log(`[${supplier.name}] HTTP appears blocked, attempting render fallback...`);

        // Try render mode as fallback if Firecrawl is configured
        if (process.env.FIRECRAWL_API_KEY) {
          try {
            const renderTimeout = supplier.timeouts?.search || 20000;
            const waitTime = 5000; // Increased wait time for JS-heavy sites
            fetchResult = await fetchRender(searchUrl, renderTimeout, waitTime);
            html = fetchResult.html;
            httpStatus = fetchResult.status;
            usedRenderFallback = true;
            searchRun.engine = 'render'; // Update engine in run metadata
            console.log(`[${supplier.name}] Successfully fetched using render fallback`);
          } catch (renderError: any) {
            console.error(`[${supplier.name}] Render fallback also failed:`, renderError.message);
            // Continue with original HTML and let the normal error handling process it
          }
        } else {
          console.warn(`[${supplier.name}] FIRECRAWL_API_KEY not configured, cannot use render fallback`);
        }
      }
    } else {
      // Render mode: first try Playwright login flow for Auger when enabled
      const pwEnabled = process.env.ENABLE_PLAYWRIGHT_LOGIN === '1' || process.env.ENABLE_PLAYWRIGHT_LOGIN === 'true';
      if (pwEnabled && supplier.name.toLowerCase().includes('auger')) {
        try {
          // Login + search load
          const { data: cred } = await supabase
            .from('supplier_credentials')
            .select('*')
            .eq('name', supplier.name)
            .eq('active', true)
            .single();
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const browser = await getBrowser();
          const context = await browser.newContext({ viewport: { width: 1366, height: 860 } });
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          if (cred && cred.login && cred.password) {
            const loginUrl: string = (supplier as any).login_url || cred.url || supplier.base_url;
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
            try { const c = await page.$('.modalOverlay .close, button.close'); if (c) await c.click({ force: true }); } catch {}
            await page.fill('input[name="emailAddress"]', String(cred.login));
            await page.fill('input[name="password"]', decryptPassword(String(cred.password)));
            try { await page.click('.btn-login', { force: true }); } catch {}
            await Promise.race([
              page.waitForSelector('#Login', { state: 'detached' }),
              page.waitForTimeout(8000),
            ]);
            // Try to toggle price visibility to "Mostrar"
            try {
              const priceCtl = await page.$('text=Preço');
              if (priceCtl) {
                await priceCtl.click({ force: true });
                await page.waitForTimeout(200);
                const showOpt = await page.$('text=Mostrar');
                if (showOpt) { await showOpt.click({ force: true }); await page.waitForTimeout(400); }
              } else {
                const btnShow = await page.$('button:has-text("Mostrar")');
                if (btnShow) { await btnShow.click({ force: true }); await page.waitForTimeout(400); }
              }
            } catch {}
          }
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
          try { await page.waitForSelector('a[href*="product-detail"]', { timeout: 20000 }); } catch {}
          await page.waitForTimeout(800);
          // Safety: try toggling price on search page too (some UIs need it per view)
          try {
            const priceCtl2 = await page.$('text=Preço');
            if (priceCtl2) {
              await priceCtl2.click({ force: true });
              await page.waitForTimeout(200);
              const showOpt2 = await page.$('text=Mostrar');
              if (showOpt2) { await showOpt2.click({ force: true }); await page.waitForTimeout(400); }
            }
          } catch {}
          try {
            const raw = await page.evaluate(() => {
              function nearest(el, selectors) {
                const list = selectors.split(',');
                let cur = el;
                for (let depth = 0; depth < 6 && cur; depth++) {
                  for (const s of list) {
                    const hit = cur.closest(s.trim());
                    if (hit) return hit;
                  }
                  cur = cur.parentElement;
                }
                return null;
              }
              function extractEuro(text) {
                if (!text) return null;
                // Common patterns: €3,50 | 3,50 € | EUR 3,50
                const m = text.match(/[€\u20AC]\s*([0-9]{1,3}(?:[\.,][0-9]{3})*(?:[\.,][0-9]{2})?)|([0-9]{1,3}(?:[\.,][0-9]{3})*(?:[\.,][0-9]{2})?)\s*[€\u20AC]/);
                if (!m) return null;
                return (m[1] || m[2] || '').trim();
              }
              const anchors = Array.from(document.querySelectorAll('a[href*="product-detail"]'));
              const out = [];
              for (const a of anchors) {
                const name = (a.textContent || '').trim();
                const card = nearest(a, '.product-item, .product, .product-card, .card, .products-item');
                let price = null, availability = null;
                if (card) {
                  // 1) Direct price nodes
                  const priceEl = card.querySelector('.price, .product-price, [class*="price" i]');
                  if (priceEl) price = priceEl.textContent?.trim() || null;
                  // 2) Label-based: "Preço líquido único"
                  if (!price) {
                    const labels = Array.from(card.querySelectorAll('*')).filter(el => /pre[cç]o/i.test(el.textContent||''));
                    for (const lbl of labels) {
                      const txt = (lbl.textContent||'').trim();
                      if (/pre[cç]o\s*l[ií]quido\s*[uú]nico/i.test(txt)) {
                        // Try sibling or same node
                        const sib = lbl.nextElementSibling as HTMLElement | null;
                        if (sib && sib.textContent) {
                          const eur = extractEuro(sib.textContent);
                          if (eur) { price = eur; break; }
                        }
                        const eur2 = extractEuro(lbl.textContent);
                        if (eur2) { price = eur2; break; }
                      }
                    }
                  }
                  // 3) Fallback: scan entire card text for euro amount
                  if (!price) {
                    const eur3 = extractEuro((card as HTMLElement).innerText || '');
                    if (eur3) price = eur3;
                  }
                  const availEl = card.querySelector('[class*="stock" i], [class*="estoque" i], [class*="unidade" i]');
                  if (availEl) availability = availEl.textContent?.trim() || null;
                }
                out.push({ name, href: a.getAttribute('href') || '', price, availability });
              }
              return out;
            });
            itemsPrefetched = (raw || [])
              .filter((r: any) => r && r.name && r.href)
              .map((r: any) => ({
                name: String(r.name),
                code: null,
                price: parsePrice(String(r.price || '')),
                availability: parseAvailability(String(r.availability || '')),
                delivery: null,
                url: extractAbsoluteUrl(String(r.href), searchUrl),
                store: supplier.name,
              } as ProductItem));
            // If still no prices, retry evaluation once more after slight reload
            const anyPrice = itemsPrefetched.some(i => i.price !== null && i.price !== undefined);
            if (!anyPrice) {
              try {
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(800);
                const raw2 = await page.evaluate(() => {
                  function nearest(el, selectors) {
                    const list = selectors.split(',');
                    let cur = el;
                    for (let depth = 0; depth < 6 && cur; depth++) {
                      for (const s of list) {
                        const hit = cur.closest(s.trim());
                        if (hit) return hit;
                      }
                      cur = cur.parentElement;
                    }
                    return null;
                  }
                  function extractEuro(text) {
                    if (!text) return null;
                    const m = text.match(/[€\u20AC]\s*([0-9]{1,3}(?:[\.,][0-9]{3})*(?:[\.,][0-9]{2})?)|([0-9]{1,3}(?:[\.,][0-9]{3})*(?:[\.,][0-9]{2})?)\s*[€\u20AC]/);
                    if (!m) return null;
                    return (m[1] || m[2] || '').trim();
                  }
                  const anchors = Array.from(document.querySelectorAll('a[href*="product-detail"]'));
                  const out = [];
                  for (const a of anchors) {
                    const name = (a.textContent || '').trim();
                    const card = nearest(a, '.product-item, .product, .product-card, .card, .products-item');
                    let price = null, availability = null;
                    if (card) {
                      const priceEl = card.querySelector('.price, .product-price, [class*="price" i]');
                      if (priceEl) price = priceEl.textContent?.trim() || null;
                      if (!price) {
                        const labels = Array.from(card.querySelectorAll('*')).filter(el => /pre[cç]o/i.test(el.textContent||''));
                        for (const lbl of labels) {
                          const txt = (lbl.textContent||'').trim();
                          if (/pre[cç]o\s*l[ií]quido\s*[uú]nico/i.test(txt)) {
                            const sib = lbl.nextElementSibling;
                            if (sib && (sib.textContent||'')) {
                              const eur = extractEuro(sib.textContent||'');
                              if (eur) { price = eur; break; }
                            }
                            const eur2 = extractEuro(lbl.textContent||'');
                            if (eur2) { price = eur2; break; }
                          }
                        }
                      }
                      if (!price) {
                        const eur3 = extractEuro((card).innerText || '');
                        if (eur3) price = eur3;
                      }
                      const availEl = card.querySelector('[class*="stock" i], [class*="estoque" i], [class*="unidade" i]');
                      if (availEl) availability = availEl.textContent?.trim() || null;
                    }
                    out.push({ name, href: a.getAttribute('href') || '', price, availability });
                  }
                  return out;
                });
                const pref2 = (raw2 || [])
                  .filter((r: any) => r && r.name && r.href)
                  .map((r: any) => ({
                    name: String(r.name),
                    code: null,
                    price: parsePrice(String(r.price || '')),
                    availability: parseAvailability(String(r.availability || '')),
                    delivery: null,
                    url: extractAbsoluteUrl(String(r.href), searchUrl),
                    store: supplier.name,
                  } as ProductItem));
                if (pref2 && pref2.length) itemsPrefetched = pref2;
              } catch {}
            }
            // Enrich items without price from detail pages up to limit
            try {
              const limitPerSupplier = parseInt(process.env.SUPPLIER_ITEM_LIMIT || '10', 10);
              const maxDetail = parseInt(process.env.SUPPLIER_DETAIL_LIMIT || '10', 10);
              const needPriced = Math.max(0, limitPerSupplier);
              const pricedCount0 = (itemsPrefetched || []).filter(i => i.price !== null && i.price !== undefined).length;
              if (itemsPrefetched && pricedCount0 < needPriced) {
                const without = itemsPrefetched.filter(i => i.price === null || i.price === undefined);
                let fetched = 0;
                for (const item of without) {
                  if (fetched >= maxDetail) break;
                  try {
                    const tab = await context.newPage();
                    tab.setDefaultTimeout(40000);
                    await tab.goto(item.url, { waitUntil: 'domcontentloaded' });
                    try { await tab.waitForSelector('.price, .product-price, [class*="price" i]', { timeout: 8000 }); } catch {}
                    const detail = await tab.evaluate(() => {
                      const priceEl = document.querySelector('.price, .product-price, [class*="price" i]');
                      const stockEl = document.querySelector('[class*="stock" i], [class*="estoque" i], [class*="unidade" i]');
                      return {
                        price: (priceEl?.textContent||'').trim() || null,
                        availability: (stockEl?.textContent||'').trim() || null,
                      };
                    });
                    item.price = parsePrice(detail.price);
                    const avn = parseAvailability(detail.availability);
                    if (avn !== null) item.availability = avn;
                    await tab.close();
                    fetched++;
                    const pricedNow = itemsPrefetched.filter(i => i.price !== null && i.price !== undefined).length;
                    if (pricedNow >= needPriced) break;
                  } catch {}
                }
              }
            } catch {}
          } catch {}
          html = await page.content();
          httpStatus = 200;
          await context.close();
        } catch (e: any) {
          console.warn('[AUGER] Playwright flow failed:', e?.message || e);
        }
      }

      if (!html) {
        // Fallback to Firecrawl render
        fetchResult = await fetchRender(searchUrl, fetchTimeout);
        html = fetchResult.html;
        httpStatus = fetchResult.status;
      }
    }

    const searchDuration = Date.now() - searchStart;

    // Check if blocked ONLY if:
    // 1. We used HTTP mode (not render)
    // 2. We didn't successfully use render fallback
    // If we used render mode or render fallback successfully, trust that it bypassed blocks
    const shouldCheckBlock = (supplier.mode === 'http' && !usedRenderFallback);

    if (shouldCheckBlock && (isBlockedByRobot(html) || looksLikeRobotBlock(html))) {
      throw new Error('BLOCKED_BY_ROBOT: Page appears to be blocking automated access');
    }

    // Step 2: Parse items
    const extractStart = Date.now();
    if (itemsPrefetched && itemsPrefetched.length > 0) {
      items = itemsPrefetched;
    } else {
      const supplierForParse: any = { ...supplier };
      if (supplier.name.toLowerCase().includes('auger')) {
        supplierForParse.selectors = supplierForParse.selectors || {};
        supplierForParse.selectors.result_selectors = supplierForParse.selectors.result_selectors || {};
        supplierForParse.selectors.result_selectors.item = 'a[href*="product-detail"]';
        supplierForParse.selectors.result_selectors.name = 'self' as any;
        supplierForParse.selectors.result_selectors.link = 'self' as any;
        supplierForParse.selectors.result_selectors.price = supplierForParse.selectors.result_selectors.price || '.price';
      }
      items = parseHtml(html, supplierForParse);
    }
    const extractDuration = Date.now() - extractStart;

    if (items.length === 0) {
      // For AUGER, treat empty as a valid (non-error) response to avoid UI "all suppliers failed"
      if (!supplier.name.toLowerCase().includes('auger')) {
        throw new Error('PARSING_ERROR: No items found with configured selectors');
      }
    }

    // Success
    const totalDuration = Date.now() - startTime;

    searchRun.status = 'success';
    searchRun.http_status_search = httpStatus;
    searchRun.durations = {
      search_ms: searchDuration,
      extract_ms: extractDuration,
      total_ms: totalDuration
    };
    searchRun.selector_counts = {
      items: items.length
    };

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    const { type, message } = classifyError(error);

    searchRun.status = 'error';
    searchRun.http_status_search = httpStatus;

    if (error.message?.startsWith('BLOCKED_BY_ROBOT')) {
      searchRun.step_failed = 'search';
      searchRun.error_message = ErrorType.BLOCKED_BY_ROBOT;
    } else if (error.message?.startsWith('PARSING_ERROR')) {
      searchRun.step_failed = 'extract';
      searchRun.error_message = ErrorType.PARSING_ERROR;
    } else if (type === ErrorType.NETWORK_ERROR) {
      searchRun.step_failed = 'search';
      searchRun.error_message = ErrorType.NETWORK_ERROR;
    } else if (type === ErrorType.HTTP_ERROR) {
      searchRun.step_failed = 'search';
      searchRun.error_message = ErrorType.HTTP_ERROR;
    } else {
      searchRun.step_failed = 'extract';
      searchRun.error_message = ErrorType.UNKNOWN_ERROR;
    }

    searchRun.error_details = message;
    searchRun.durations = {
      total_ms: totalDuration
    };
  }

  // Store in database
  const { data: insertedRun, error: dbError } = await supabase
    .from('search_runs')
    .insert(searchRun)
    .select()
    .single();

  if (dbError) {
    console.error('Failed to insert search_run:', dbError);
  } else {
    searchRun.id = insertedRun.id;
    searchRun.created_at = insertedRun.created_at;
  }

  // Store debug snapshot if requested or on error
  if ((debug || searchRun.status === 'error') && html && searchRun.id) {
    const snapshotUrl = await storeDebugSnapshot(searchRun.id, html);
    if (snapshotUrl) {
      searchRun.debug_snapshot_url = snapshotUrl;

      // Update database with snapshot URL
      await supabase
        .from('search_runs')
        .update({ debug_snapshot_url: snapshotUrl })
        .eq('id', searchRun.id);
    }
  }

  return { items, searchRun };
}
