import axios, { AxiosError } from 'axios';
import { Supplier, ProductItem, SearchRun, ErrorType } from '../types';
import { parseHtml, parseNipocar } from '../utils/parser';
import { looksLikeRobotBlock } from '../utils/fetch-helpers';
import { logger } from '../utils/logger';
import { getProviderForSupplier } from '../providers';
import { isAuthenticatedEvoPartsHtml, fetchEvoPartsFromCachedSession } from '../providers/evoparts';
import { resolveRuntimeCredential } from './supplier-runtime';
import { getSupplierKey } from '../utils/supplier-utils';
import { persistSearchRun, storeDebugSnapshot, updateDebugSnapshotUrl } from './search-run-repository';
import { getSupplierAuthStateCached } from './supplier-auth';

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutRef: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutRef = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutRef) clearTimeout(timeoutRef);
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
  debug: boolean = false,
  providedCredential: any = null
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
  const persistErrorSnapshots =
    process.env.STORE_ERROR_SNAPSHOTS === '1' ||
    process.env.STORE_ERROR_SNAPSHOTS === 'true';

  try {
    // Step 1: Fetch page
    const searchStart = Date.now();
    const supplierKey = getSupplierKey(supplier);

    // Fast-exit: if GSMART session is expired, skip Playwright entirely (saves ~50s)
    if (supplierKey === 'gsmart' && supplier.id) {
      const gsmartState = getSupplierAuthStateCached(supplier.id);
      if (gsmartState === 'MANUAL_REQUIRED') {
        throw new Error('CAPTCHA_REQUIRED: GSMART manual session required — use the login button to renew');
      }
    }

    const isEvoParts = supplierKey === 'evoparts';
    const defaultFetchTimeout = supplier.timeouts?.search || (supplier.mode === 'http' ? 10000 : 15000);
    const fetchTimeout = isEvoParts ? Math.max(defaultFetchTimeout, 25000) : defaultFetchTimeout;

  // Try dedicated provider first (e.g., Nipocar, Martex custom flows)
  const provider = getProviderForSupplier(supplier);
  const preferProvider = supplierKey === 'nipocar';
  const evoPartsCacheKey = `evoparts-${supplier.id || supplier.name || 'default'}`;
  const runtimeCred = providedCredential || await resolveRuntimeCredential(supplier);

  let providerFailure: Error | null = null;
  const canUseProviderWithoutCreds = supplierKey === 'gsmart';
  if (provider && (runtimeCred || canUseProviderWithoutCreds) && (preferProvider || !html)) {
    try {
      const providerResult = await withTimeout(
        provider.loginAndFetch(supplier, (runtimeCred || ({} as any)) as any, searchUrl, fetchTimeout),
        fetchTimeout + 30000,
        `${supplier.name.toUpperCase()}_PROVIDER`
      );
      if (providerResult.error) {
        providerFailure = providerResult.error;
      }
      const providerHtmlLooksAuthenticated = isEvoParts
        ? isAuthenticatedEvoPartsHtml(providerResult.html || '')
        : providerResult.html && !providerResult.html.includes('id="Login"');
      if (providerHtmlLooksAuthenticated) {
        html = providerResult.html;
        httpStatus = providerResult.status;
          searchRun.engine = 'render';
        }
      } catch (e: any) {
        providerFailure = e as Error;
        logger.error('[%s] provider fetch failed: %s', supplier.name, e?.message || e);
      }
    }

    if (
      supplierKey === 'gsmart' &&
      providerFailure &&
      String(providerFailure.message || '').startsWith('CAPTCHA_REQUIRED')
    ) {
      throw providerFailure;
    }

    let fetchResult: { html: string; status: number };
    let usedRenderFallback = false;
    let usedProviderSession = false;
    if (html && !html.includes('id="Login"')) {
      usedProviderSession = !isEvoParts || isAuthenticatedEvoPartsHtml(html);
    }

    if (!usedProviderSession && isEvoParts) {
      const cachedResult = await fetchEvoPartsFromCachedSession(evoPartsCacheKey, searchUrl, fetchTimeout);
      if (cachedResult.html) {
        html = cachedResult.html;
        httpStatus = cachedResult.status;
        searchRun.engine = 'http';
        usedProviderSession = true;
      }
    }

    if (usedProviderSession && isEvoParts && !isAuthenticatedEvoPartsHtml(html)) {
      html = '';
      httpStatus = null;
      usedProviderSession = false;
    }

    if (!usedProviderSession) {
      if (supplier.mode === 'http') {
        // Try HTTP first
        fetchResult = await fetchHttp(searchUrl, fetchTimeout);
        html = fetchResult.html;
        httpStatus = fetchResult.status;

        // Check if it looks like we're being blocked
        if (looksLikeRobotBlock(html)) {
          logger.warn('[%s] HTTP appears blocked, attempting render fallback...', supplier.name);

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
              logger.info('[%s] Successfully fetched using render fallback', supplier.name);
            } catch (renderError: any) {
              logger.error('[%s] Render fallback also failed: %s', supplier.name, renderError.message);
              // Continue with original HTML and let the normal error handling process it
            }
          } else {
            logger.warn('[%s] FIRECRAWL_API_KEY not configured, cannot use render fallback', supplier.name);
          }
        }
      } else {
        // Render mode: AugerProvider handles Playwright login via the provider path above.
        // Fall back to Firecrawl render for any render-mode supplier without a provider session.
        if (!html) {
          fetchResult = await fetchRender(searchUrl, fetchTimeout);
          html = fetchResult.html;
          httpStatus = fetchResult.status;
        }
      }
    }

    const searchDuration = Date.now() - searchStart;

    // Check if blocked ONLY if:
    // 1. We used HTTP mode (not render)
    // 2. We didn't successfully use render fallback
    // If we used render mode or render fallback successfully, trust that it bypassed blocks
    const shouldCheckBlock = (supplier.mode === 'http' && !usedRenderFallback && !usedProviderSession);

    if (shouldCheckBlock && (looksLikeRobotBlock(html))) {
      throw new Error('BLOCKED_BY_ROBOT: Page appears to be blocking automated access');
    }

    // Step 2: Parse items
    const extractStart = Date.now();
    {
      const supplierForParse: any = { ...supplier };
      if (supplierKey === 'auger') {
        supplierForParse.selectors = supplierForParse.selectors || {};
        supplierForParse.selectors.result_selectors = supplierForParse.selectors.result_selectors || {};
        supplierForParse.selectors.result_selectors.item = 'a[href*="product-detail"]';
        supplierForParse.selectors.result_selectors.name = 'self' as any;
        supplierForParse.selectors.result_selectors.link = 'self' as any;
        supplierForParse.selectors.result_selectors.price = supplierForParse.selectors.result_selectors.price || '.price';
      }
      if (supplierKey === 'nipocar') {
        items = parseNipocar(html, supplierForParse);

        // Fallback: if all Nipocar items came without price, try provider (rendered) fetch once
        const allPricesNull = items.length > 0 && items.every(i => i.price === null || i.price === undefined);
        if (allPricesNull && provider && runtimeCred) {
          try {
            const providerResult = await withTimeout(
              provider.loginAndFetch(supplier, runtimeCred, searchUrl, fetchTimeout),
              fetchTimeout + 30000,
              `${supplier.name.toUpperCase()}_PROVIDER`
            );
            if (providerResult.html) {
              html = providerResult.html;
              items = parseNipocar(html, supplierForParse);
            }
          } catch (e: any) {
            logger.warn('[Nipocar] fallback provider fetch failed: %s', e?.message || e);
          }
        }

        if (items.length === 0) {
          items = parseHtml(html, supplierForParse);
        }
      } else {
        items = parseHtml(html, supplierForParse);
      }
    }
    const extractDuration = Date.now() - extractStart;

    // Zero results is a valid outcome (e.g., referência inexistente); do not throw.

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
    const rawErrorMessage = String(error?.message || '');
    const isGsmartSupplier = getSupplierKey(supplier) === 'gsmart';
    const isGsmartSessionExpired = isGsmartSupplier && rawErrorMessage.startsWith('CAPTCHA_REQUIRED');

    searchRun.status = 'error';
    searchRun.http_status_search = httpStatus;

    if (isGsmartSessionExpired) {
      searchRun.step_failed = 'search';
      searchRun.error_message = 'GSMART_SESSION_EXPIRED';
    } else if (error.message?.startsWith('BLOCKED_BY_ROBOT')) {
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

    if (isGsmartSessionExpired) {
      searchRun.error_details =
        'GSMART session expired or missing. Run `cd backend && npm run gsmart:init-session`, solve the captcha in the opened browser, then retry the search.';
    } else {
      searchRun.error_details = error?.stack || message;
    }
    searchRun.durations = {
      total_ms: totalDuration
    };
  }

  // Persist to database
  await persistSearchRun(searchRun);

  // Store debug snapshot if requested or on error
  if ((debug || (persistErrorSnapshots && searchRun.status === 'error')) && html && searchRun.id) {
    const snapshotUrl = await storeDebugSnapshot(searchRun.id, html);
    if (snapshotUrl) {
      searchRun.debug_snapshot_url = snapshotUrl;
      await updateDebugSnapshotUrl(searchRun.id, snapshotUrl);
    }
  }

  return { items, searchRun };
}
