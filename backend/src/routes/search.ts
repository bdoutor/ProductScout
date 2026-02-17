import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';

import { logger } from '../utils/logger';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { scrapeSupplier } from '../services/scraper';
import { sortItems } from '../utils/parser';
import {
  ProductItem,
  SearchResponse,
  SearchRun,
  Supplier,
  SupplierCredential,
  SupplierResult
} from '../types';

const router = Router();

const cacheTtlSeconds = Math.max(30, Math.floor((Number(process.env.SEARCH_CACHE_TTL_MS || '300000')) / 1000));
const resultCache = new NodeCache({ stdTTL: cacheTtlSeconds, checkperiod: Math.max(30, Math.floor(cacheTtlSeconds / 2)) });
const concurrency = Math.max(1, Number(process.env.SEARCH_CONCURRENCY || '2'));
const limit = pLimit(concurrency);
const jobTtlMs = Math.max(5 * 60 * 1000, Number(process.env.SEARCH_JOB_TTL_MS || '600000'));
const progressPollMs = Math.max(1000, Number(process.env.SEARCH_PROGRESS_POLL_MS || '5000'));
const progressiveJobs = new Map<string, ProgressiveSearchJob>();
const allowMockFallback =
  process.env.ALLOW_SEARCH_MOCK_FALLBACK === '1' ||
  process.env.ALLOW_SEARCH_MOCK_FALLBACK === 'true';

interface SupplierRunResult {
  supplier: Supplier;
  items: ProductItem[];
  searchRun: SearchRun;
}

interface ProgressiveSearchJob {
  id: string;
  query: string;
  debug: boolean;
  totalSuppliers: number;
  completedSuppliers: number;
  startedAt: number;
  lastUpdate: number;
  perSupplier: SupplierResult[];
  runResults: Record<string, SupplierRunResult>;
  done: boolean;
  message?: string;
  error?: string;
}

class SupplierSelectionError extends Error {
  statusCode: number;
  isNoSuppliers: boolean;
  clientMessage: string;

  constructor(message: string, clientMessage: string, statusCode = 500, isNoSuppliers = false) {
    super(message);
    this.name = 'SupplierSelectionError';
    this.statusCode = statusCode;
    this.isNoSuppliers = isNoSuppliers;
    this.clientMessage = clientMessage;
  }
}

const cleanupIntervalMs = Math.max(60000, Math.floor(jobTtlMs / 2));
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of progressiveJobs.entries()) {
    if (now - job.startedAt > jobTtlMs) {
      progressiveJobs.delete(id);
    }
  }
}, cleanupIntervalMs).unref?.();

function buildFallbackResponse(query: string): SearchResponse {
  const mockItems: ProductItem[] = [
    {
      name: `AUGER Product - ${query}`,
      code: query,
      price: 199.99,
      availability: 5,
      delivery: '2-3 business days',
      url: `https://auger-shop.com/product/${query}`,
      store: 'AUGER (mock)'
    },
    {
      name: `Alternative Part - ${query}`,
      code: `ALT-${query}`,
      price: 149.99,
      availability: 3,
      delivery: '1-2 business days',
      url: `https://auger-shop.com/product/alt-${query}`,
      store: 'AUGER (mock)'
    }
  ];

  return {
    query,
    items: mockItems,
    per_supplier: [
      {
        supplier_name: 'Mock Supplier',
        status: 'success',
        items_found: mockItems.length,
        search_run_id: 'mock-run'
      }
    ],
    message: 'Supabase not configured. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for real results.'
  };
}

async function loadSelectedSuppliers(): Promise<Supplier[]> {
  const sb = supabase;
  if (!sb) {
    throw new SupplierSelectionError(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      'Supabase not configured',
      503,
      true
    );
  }

  const { data: creds, error: credsError } = await sb
    .from('supplier_credentials')
    .select('*')
    .eq('active', true);

  if (credsError) {
    // Network/DNS problems surface as "fetch failed" in @supabase/supabase-js
    const isNetworkError = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(credsError.message || '');
    if (isNetworkError) {
      throw new SupplierSelectionError(
        `Supabase unavailable: ${credsError.message}`,
        'Supabase unavailable',
        503,
        true
      );
    }
    throw new SupplierSelectionError(
      `Failed to load supplier credentials: ${credsError.message}`,
      'Failed to load supplier credentials'
    );
  }

  const { data: suppliers, error: suppliersError } = await sb
    .from('suppliers')
    .select('*')
    .eq('enabled', true);

  if (suppliersError) {
    const isNetworkError = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(suppliersError.message || '');
    if (isNetworkError) {
      throw new SupplierSelectionError(
        `Supabase unavailable: ${suppliersError.message}`,
        'Supabase unavailable',
        503,
        true
      );
    }
    throw new SupplierSelectionError(
      `Failed to load suppliers: ${suppliersError.message}`,
      'Failed to load suppliers'
    );
  }

  const allowedNames = new Set((creds || []).map((c: SupplierCredential) => String(c.name).toLowerCase().trim()));

  const selectedSuppliers = (suppliers || []).filter((s: Supplier) => {
    const nameKey = String(s.name).toLowerCase().trim();
    const hasCredential = allowedNames.has(nameKey);
    const hasInlineCreds = Boolean(s.login && s.password && (s.login_url || s.url || s.base_url));
    return hasCredential || hasInlineCreds;
  }) as Supplier[];

  if (selectedSuppliers.length === 0) {
    throw new SupplierSelectionError(
      'No suppliers enabled with credentials. Configure Supabase data for real searches.',
      'No suppliers enabled with credentials',
      503,
      true
    );
  }

  return selectedSuppliers;
}

function buildSupplierErrorResult(supplier: Supplier, query: string, err: any): SupplierRunResult {
  return {
    supplier,
    items: [],
    searchRun: {
      reference: query,
      supplier_id: supplier.id,
      status: 'error',
      engine: supplier.mode,
      search_url_effective: supplier.search_url_template.replace('{query}', encodeURIComponent(query)),
      error_message: err?.message || 'Unknown error'
    }
  };
}

async function runSupplierSearch(supplier: Supplier, query: string, debug: boolean): Promise<SupplierRunResult> {
  const cacheKey = `${supplier.id}:${query}`;
  if (!debug) {
    const cached = resultCache.get<SupplierRunResult>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const { items, searchRun } = await scrapeSupplier(supplier, query, Boolean(debug));

    const limitPerSupplier = Number(process.env.SUPPLIER_ITEM_LIMIT || '10');
    const boundedItems = Number.isFinite(limitPerSupplier) && limitPerSupplier > 0
      ? items.slice(0, limitPerSupplier)
      : items;

    const result: SupplierRunResult = {
      supplier,
      items: boundedItems,
      searchRun
    };

    if (searchRun.status === 'success') {
      resultCache.set(cacheKey, result);
    }

    return result;
  } catch (err: any) {
    logger.error(`scrapeSupplier failed for ${supplier.name}: ${err?.message || err}`);
    return buildSupplierErrorResult(supplier, query, err);
  }
}

function aggregateRunResults(runResults: SupplierRunResult[], query: string): SearchResponse {
  const aggregatedItems = runResults.flatMap(r => r.items);
  const sortedItems = sortItems([...aggregatedItems]);

  const perSupplier: SupplierResult[] = runResults.map((run) => ({
    supplier_name: run.supplier.name,
    supplier_id: run.supplier.id,
    status: run.searchRun.status === 'success' ? 'success' : 'error',
    items_found: run.items.length,
    search_run_id: run.searchRun.id,
    error_message: run.searchRun.error_message || run.searchRun.error_details || undefined,
    error_details: run.searchRun.error_details || undefined
  }));

  const response: SearchResponse = {
    query,
    items: sortedItems,
    per_supplier: perSupplier
  };

  if (sortedItems.length === 0) {
    response.message = perSupplier.every(p => p.status === 'error')
      ? 'All suppliers failed. Check credentials and scraping configuration.'
      : 'No products found for the supplied reference.';
  } else if (sortedItems.every(item => (item.availability ?? 0) <= 0)) {
    response.message = 'Products found but none show positive stock.';
  }

  return response;
}

function updateJobWithResult(jobId: string, result: SupplierRunResult) {
  const job = progressiveJobs.get(jobId);
  if (!job) {
    return;
  }

  job.runResults[result.supplier.id] = result;
  job.lastUpdate = Date.now();
  job.completedSuppliers = Object.keys(job.runResults).length;

  job.perSupplier = job.perSupplier.map((entry) => {
    if (entry.supplier_id === result.supplier.id || entry.supplier_name === result.supplier.name) {
      return {
        ...entry,
        status: result.searchRun.status === 'success' ? 'success' : 'error',
        items_found: result.items.length,
        search_run_id: result.searchRun.id,
        error_message: result.searchRun.error_message || result.searchRun.error_details || undefined,
        error_details: result.searchRun.error_details || undefined
      };
    }
    return entry;
  });

  if (job.completedSuppliers >= job.totalSuppliers) {
    job.done = true;
    const finalResponse = aggregateRunResults(Object.values(job.runResults), job.query);
    job.message = finalResponse.message;
  }
}

function startProgressiveJob(job: ProgressiveSearchJob, suppliers: Supplier[], query: string, debug: boolean) {
  suppliers.forEach((supplier) => {
    limit(async () => runSupplierSearch(supplier, query, debug))
      .then((result) => updateJobWithResult(job.id, result))
      .catch((err) => {
        logger.error(`Progressive search failed for ${supplier.name}: ${err?.message || err}`);
        updateJobWithResult(job.id, buildSupplierErrorResult(supplier, query, err));
      });
  });
}

function getJobItems(job: ProgressiveSearchJob): ProductItem[] {
  const aggregated = Object.values(job.runResults).flatMap((r) => r.items);
  if (aggregated.length === 0) {
    return [];
  }
  return sortItems([...aggregated]);
}

function buildProgressPayload(job: ProgressiveSearchJob) {
  const response: SearchResponse = {
    query: job.query,
    items: getJobItems(job),
    per_supplier: job.perSupplier
  };

  if (job.done && job.message) {
    response.message = job.message;
  }

  return {
    ...response,
    run_id: job.id,
    total_suppliers: job.totalSuppliers,
    completed_suppliers: job.completedSuppliers,
    done: job.done,
    error: job.error,
    last_update: new Date(job.lastUpdate).toISOString()
  };
}

function handleSelectionError(res: Response, error: SupplierSelectionError, query: string) {
  if (error.isNoSuppliers && allowMockFallback) {
    logger.warn(error.message);
    const response = buildFallbackResponse(query);
    response.message = error.clientMessage;
    return res.status(200).json(response);
  }

  logger.error(error.message);
  return res.status(error.statusCode).json({ error: error.clientMessage });
}

router.post('/search', async (req: Request, res: Response) => {
  const { query, debug = false } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  if (!isSupabaseConfigured() || !supabase) {
    if (allowMockFallback) {
      logger.warn('Search requested but Supabase is not configured; returning mock fallback');
      return res.status(200).json(buildFallbackResponse(query));
    }
    logger.warn('Search requested but Supabase is not configured');
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const selectedSuppliers = await loadSelectedSuppliers();
    const tasks = selectedSuppliers.map((supplier) => limit(() => runSupplierSearch(supplier, query, Boolean(debug))));
    const runResults = await Promise.all(tasks);
    const response = aggregateRunResults(runResults, query);
    return res.json(response);
  } catch (error: any) {
    if (error instanceof SupplierSelectionError) {
      return handleSelectionError(res, error, query);
    }
    logger.error('Unexpected search failure: %s', error?.message || error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unknown failure during search'
    });
  }
});

router.post('/search/progressive', async (req: Request, res: Response) => {
  const { query, debug = false } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  if (!isSupabaseConfigured() || !supabase) {
    if (allowMockFallback) {
      logger.warn('Progressive search requested but Supabase is not configured; returning mock fallback');
      const fallback = buildFallbackResponse(query);
      return res.status(200).json({ fallback });
    }
    logger.warn('Progressive search requested but Supabase is not configured');
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const selectedSuppliers = await loadSelectedSuppliers();
    const jobId = randomUUID();
    const job: ProgressiveSearchJob = {
      id: jobId,
      query,
      debug: Boolean(debug),
      totalSuppliers: selectedSuppliers.length,
      completedSuppliers: 0,
      startedAt: Date.now(),
      lastUpdate: Date.now(),
      perSupplier: selectedSuppliers.map((supplier) => ({
        supplier_name: supplier.name,
        supplier_id: supplier.id,
        status: 'pending',
        items_found: 0
      })),
      runResults: {},
      done: selectedSuppliers.length === 0
    };

    progressiveJobs.set(jobId, job);

    if (selectedSuppliers.length === 0 && allowMockFallback) {
      job.done = true;
      const fallback = buildFallbackResponse(query);
      job.message = fallback.message;
      job.perSupplier = fallback.per_supplier;
    } else {
      startProgressiveJob(job, selectedSuppliers, query, Boolean(debug));
    }

    return res.status(202).json({
      run_id: jobId,
      total_suppliers: job.totalSuppliers,
      poll_interval_ms: progressPollMs
    });
  } catch (error: any) {
    if (error instanceof SupplierSelectionError) {
      if (error.isNoSuppliers && allowMockFallback) {
        const fallback = buildFallbackResponse(query);
        fallback.message = error.clientMessage;
        return res.status(200).json({ fallback });
      }
      logger.error(error.message);
      return res.status(error.statusCode).json({ error: error.clientMessage });
    }

    logger.error('Failed to start progressive search: %s', error?.message || error);
    return res.status(500).json({ error: 'Failed to start progressive search' });
  }
});

router.get('/search/progressive/:runId', (req: Request, res: Response) => {
  const { runId } = req.params;
  if (!runId) {
    return res.status(400).json({ error: 'runId parameter is required' });
  }

  const job = progressiveJobs.get(runId);
  if (!job) {
    return res.status(404).json({ error: 'Search run not found' });
  }

  return res.json(buildProgressPayload(job));
});

export default router;

