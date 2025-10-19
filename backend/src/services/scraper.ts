import axios, { AxiosError } from 'axios';
import { Supplier, ProductItem, SearchRun, ErrorType } from '../types';
import { parseHtml, isBlockedByRobot } from '../utils/parser';
import { supabase } from '../utils/supabase';
import { looksLikeRobotBlock } from '../utils/fetch-helpers';

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
async function fetchRender(url: string, timeout: number = 15000, waitTime: number = 3500): Promise<{ html: string; status: number }> {
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
      // Use render mode directly
      fetchResult = await fetchRender(searchUrl, fetchTimeout);
      html = fetchResult.html;
      httpStatus = fetchResult.status;
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
    items = parseHtml(html, supplier);
    const extractDuration = Date.now() - extractStart;

    if (items.length === 0) {
      throw new Error('PARSING_ERROR: No items found with configured selectors');
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
