import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';

import { logger } from '../utils/logger';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { scrapeSupplier } from '../services/scraper';
import {
  SupplierSearchTarget,
  loadEnabledSupplierTargets
} from '../services/supplier-runtime';
import {
  getManualSupplierSessionJob,
  getSupplierAuthStatuses,
  refreshSupplierAuthStatuses,
  startManualSupplierSessionJob
} from '../services/supplier-auth';
import {
  ProductItem,
  SearchResponse,
  SearchResponseSummary,
  SearchRun,
  SupplierResult
} from '../types';

const router = Router();

const cacheTtlSeconds = Math.max(30, Math.floor((Number(process.env.SEARCH_CACHE_TTL_MS || '300000')) / 1000));
const resultCache = new NodeCache({ stdTTL: cacheTtlSeconds, checkperiod: Math.max(30, Math.floor(cacheTtlSeconds / 2)) });
const jobTtlMs = Math.max(5 * 60 * 1000, Number(process.env.SEARCH_JOB_TTL_MS || '600000'));
const progressPollMs = Math.max(1000, Number(process.env.SEARCH_PROGRESS_POLL_MS || '5000'));
const progressiveJobs = new Map<string, ProgressiveSearchJob>();
const allowMockFallback =
  process.env.ALLOW_SEARCH_MOCK_FALLBACK === '1' ||
  process.env.ALLOW_SEARCH_MOCK_FALLBACK === 'true';
const GSMART_SESSION_EXPIRED = 'GSMART_SESSION_EXPIRED';

interface SupplierRunResult {
  supplier: SupplierSearchTarget['supplier'];
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

function resolveSearchConcurrency(totalSuppliers: number): number {
  const configured = Number(process.env.SEARCH_CONCURRENCY || '');
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.floor(configured));
  }
  // Default: run all selected suppliers concurrently for the fastest first results.
  return Math.max(1, totalSuppliers);
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
    message: 'Supabase not configured. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for real results.',
    summary: buildResponseSummary(mockItems, [
      {
        supplier_name: 'Mock Supplier',
        status: 'success',
        items_found: mockItems.length,
        search_run_id: 'mock-run'
      }
    ])
  };
}

async function loadSelectedSuppliers(requestedSupplierIds?: string[]): Promise<SupplierSearchTarget[]> {
  let supplierTargets: SupplierSearchTarget[] = [];
  try {
    supplierTargets = await loadEnabledSupplierTargets(false);
  } catch (error: any) {
    const message = String(error?.message || '');
    const isNetworkError = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(message);
    if (isNetworkError) {
      throw new SupplierSelectionError(
        `Supabase unavailable: ${message}`,
        'Supabase unavailable',
        503,
        true
      );
    }
    throw new SupplierSelectionError(
      `Failed to load supplier registry: ${message}`,
      'Failed to load suppliers'
    );
  }

  const usableTargets = supplierTargets.filter((target) => {
    if (target.auth_mode === 'manual') {
      return target.reusable_session || Boolean(target.credential?.login);
    }
    if (target.auth_mode === 'auto') {
      return Boolean(target.credential?.login);
    }
    return true;
  });

  if (usableTargets.length === 0) {
    throw new SupplierSelectionError(
      'No suppliers enabled with credentials. Configure Supabase data for real searches.',
      'No suppliers enabled with credentials',
      503,
      true
    );
  }

  if (Array.isArray(requestedSupplierIds)) {
    const requested = Array.from(
      new Set(
        requestedSupplierIds
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );

    if (requested.length === 0) {
      throw new SupplierSelectionError(
        'Selected supplier list is empty.',
        'Select at least one supplier before searching.',
        400
      );
    }

    const requestedSet = new Set(requested);
    const filteredSuppliers = usableTargets.filter((target) =>
      requestedSet.has(String(target.supplier.id))
    );

    if (filteredSuppliers.length === 0) {
      throw new SupplierSelectionError(
        `No requested suppliers are available: ${requested.join(', ')}`,
        'The selected suppliers are currently unavailable or disabled.',
        400
      );
    }

    return filteredSuppliers;
  }

  return usableTargets;
}

function buildSupplierErrorResult(target: SupplierSearchTarget, query: string, err: any): SupplierRunResult {
  return {
    supplier: target.supplier,
    items: [],
    searchRun: {
      reference: query,
      supplier_id: target.supplier.id,
      status: 'error',
      engine: target.supplier.mode,
      search_url_effective: target.supplier.search_url_template.replace('{query}', encodeURIComponent(query)),
      error_message: err?.message || 'Unknown error'
    }
  };
}

async function runSupplierSearch(target: SupplierSearchTarget, query: string, debug: boolean): Promise<SupplierRunResult> {
  const startedAt = Date.now();
  const supplier = target.supplier;
  logger.info('Supplier search started: supplier=%s query=%s', supplier.name, query);
  const cacheKey = `${supplier.id}:${query}`;
  if (!debug) {
    const cached = resultCache.get<SupplierRunResult>(cacheKey);
    if (cached) {
      logger.info(
        'Supplier search cache hit: supplier=%s query=%s elapsed_ms=%d',
        supplier.name,
        query,
        Date.now() - startedAt
      );
      return cached;
    }
  }

  try {
    const { items, searchRun } = await scrapeSupplier(supplier, query, Boolean(debug), target.credential);

    const limitPerSupplier = Number(process.env.SUPPLIER_ITEM_LIMIT || '0');
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

    logger.info(
      'Supplier search finished: supplier=%s status=%s items=%d elapsed_ms=%d',
      supplier.name,
      searchRun.status,
      result.items.length,
      Date.now() - startedAt
    );

    return result;
  } catch (err: any) {
    logger.error(`scrapeSupplier failed for ${supplier.name}: ${err?.message || err}`);
    logger.info(
      'Supplier search finished: supplier=%s status=error items=0 elapsed_ms=%d',
      supplier.name,
      Date.now() - startedAt
    );
    return buildSupplierErrorResult(target, query, err);
  }
}

function buildResponseSummary(items: ProductItem[], perSupplier: SupplierResult[]): SearchResponseSummary {
  const availableItems = items.filter((item) => (item.availability ?? 0) > 0).length;
  const unknownAvailabilityItems = items.filter((item) => item.availability === null || item.availability === undefined).length;
  const unavailableItems = items.filter((item) => item.availability !== null && item.availability !== undefined && item.availability <= 0).length;
  const suppliersSuccess = perSupplier.filter((entry) => entry.status === 'success').length;
  const suppliersError = perSupplier.filter((entry) => entry.status === 'error').length;
  const suppliersPending = perSupplier.filter((entry) => entry.status === 'pending').length;

  return {
    total_items: items.length,
    available_items: availableItems,
    unavailable_items: unavailableItems,
    unknown_availability_items: unknownAvailabilityItems,
    suppliers_total: perSupplier.length,
    suppliers_success: suppliersSuccess,
    suppliers_error: suppliersError,
    suppliers_pending: suppliersPending,
  };
}

function sortAggregatedItems(items: ProductItem[]): ProductItem[] {
  return items
    .slice()
    .sort((a, b) => {
      const availabilityOrderA = (a.availability ?? 0) > 0 ? 0 : 1;
      const availabilityOrderB = (b.availability ?? 0) > 0 ? 0 : 1;
      if (availabilityOrderA !== availabilityOrderB) return availabilityOrderA - availabilityOrderB;

      const priceA = a.price ?? Number.POSITIVE_INFINITY;
      const priceB = b.price ?? Number.POSITIVE_INFINITY;
      if (priceA !== priceB) return priceA - priceB;

      return String(a.store || '').localeCompare(String(b.store || ''), 'pt', { sensitivity: 'base' });
    });
}

function aggregateRunResults(runResults: SupplierRunResult[], query: string): SearchResponse {
  const orderedItems = sortAggregatedItems(runResults.flatMap((run) => run.items));

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
    items: orderedItems,
    per_supplier: perSupplier,
    summary: buildResponseSummary(orderedItems, perSupplier)
  };
  const hasGsmartSessionExpired = perSupplier.some((entry) => {
    const code = String(entry.error_message || '').toUpperCase();
    return code.includes(GSMART_SESSION_EXPIRED);
  });

  if (orderedItems.length === 0) {
    if (hasGsmartSessionExpired) {
      response.message = 'Sessão GSMART expirada. Usa o botão "Login manual" ao lado do fornecedor GSMART para renovar a sessão.';
    } else {
      response.message = perSupplier.every(p => p.status === 'error')
        ? 'All suppliers failed. Check credentials and scraping configuration.'
        : 'No products found for the supplied reference.';
    }
  } else if (orderedItems.every(item => (item.availability ?? 0) <= 0)) {
    response.message = 'Products found but none show positive stock.';
  }

  return response;
}

function updateJobWithResult(jobId: string, result: SupplierRunResult) {
  const job = progressiveJobs.get(jobId);
  if (!job) {
    return;
  }

  const finishedAt = new Date().toISOString();
  job.runResults[result.supplier.id] = result;
  job.lastUpdate = Date.now();
  job.completedSuppliers = Object.keys(job.runResults).length;

  job.perSupplier = job.perSupplier.map((entry) => {
    if (entry.supplier_id === result.supplier.id || entry.supplier_name === result.supplier.name) {
      const startedMs = entry.started_at ? Date.parse(entry.started_at) : NaN;
      const elapsedMs = Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : undefined;
      return {
        ...entry,
        status: result.searchRun.status === 'success' ? 'success' : 'error',
        items_found: result.items.length,
        search_run_id: result.searchRun.id,
        error_message: result.searchRun.error_message || result.searchRun.error_details || undefined,
        error_details: result.searchRun.error_details || undefined,
        finished_at: finishedAt,
        elapsed_ms: elapsedMs
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

function startProgressiveJob(job: ProgressiveSearchJob, suppliers: SupplierSearchTarget[], query: string, debug: boolean) {
  const effectiveConcurrency = resolveSearchConcurrency(suppliers.length);
  const runWithLimit = pLimit(effectiveConcurrency);
  logger.info(
    'Starting progressive search run %s with %d suppliers (concurrency=%d)',
    job.id,
    suppliers.length,
    effectiveConcurrency
  );

  suppliers.forEach((target) => {
    runWithLimit(async () => {
      const activeJob = progressiveJobs.get(job.id);
      if (activeJob) {
        const startedAt = new Date().toISOString();
        activeJob.lastUpdate = Date.now();
        activeJob.perSupplier = activeJob.perSupplier.map((entry) => {
          if (entry.supplier_id === target.supplier.id || entry.supplier_name === target.supplier.name) {
            return {
              ...entry,
              started_at: entry.started_at || startedAt
            };
          }
          return entry;
        });
      }
      return runSupplierSearch(target, query, debug);
    })
      .then((result) => updateJobWithResult(job.id, result))
      .catch((err) => {
        logger.error(`Progressive search failed for ${target.supplier.name}: ${err?.message || err}`);
        updateJobWithResult(job.id, buildSupplierErrorResult(target, query, err));
      });
  });
}

function getJobItems(job: ProgressiveSearchJob): ProductItem[] {
  const orderedBySupplier = job.perSupplier.flatMap((supplierResult) => {
    const supplierId = String(supplierResult.supplier_id || '');
    const run = job.runResults[supplierId];
    return run?.items || [];
  });

  if (orderedBySupplier.length > 0) {
    return orderedBySupplier;
  }

  return Object.values(job.runResults).flatMap((run) => run.items);
}

function buildProgressPayload(job: ProgressiveSearchJob) {
  const items = sortAggregatedItems(getJobItems(job));
  const response: SearchResponse = {
    query: job.query,
    items,
    per_supplier: job.perSupplier,
    summary: buildResponseSummary(items, job.perSupplier)
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
  const { query, debug = false, selected_supplier_ids } = req.body || {};
  const selectedSupplierIds = Array.isArray(selected_supplier_ids)
    ? selected_supplier_ids.map((value: any) => String(value || '').trim()).filter(Boolean)
    : undefined;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  if (selected_supplier_ids !== undefined && !Array.isArray(selected_supplier_ids)) {
    return res.status(400).json({ error: 'selected_supplier_ids must be an array of supplier ids' });
  }
  if (Array.isArray(selected_supplier_ids) && selectedSupplierIds?.length === 0) {
    return res.status(400).json({ error: 'Select at least one supplier before searching' });
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
    const selectedSuppliers = await loadSelectedSuppliers(selectedSupplierIds);
    const effectiveConcurrency = resolveSearchConcurrency(selectedSuppliers.length);
    const runWithLimit = pLimit(effectiveConcurrency);
    logger.info(
      'Starting search with %d suppliers (concurrency=%d)',
      selectedSuppliers.length,
      effectiveConcurrency
    );
    const tasks = selectedSuppliers.map((supplier) =>
      runWithLimit(() => runSupplierSearch(supplier, query, Boolean(debug)))
    );
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
  const { query, debug = false, selected_supplier_ids } = req.body || {};
  const selectedSupplierIds = Array.isArray(selected_supplier_ids)
    ? selected_supplier_ids.map((value: any) => String(value || '').trim()).filter(Boolean)
    : undefined;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  if (selected_supplier_ids !== undefined && !Array.isArray(selected_supplier_ids)) {
    return res.status(400).json({ error: 'selected_supplier_ids must be an array of supplier ids' });
  }
  if (Array.isArray(selected_supplier_ids) && selectedSupplierIds?.length === 0) {
    return res.status(400).json({ error: 'Select at least one supplier before searching' });
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
    const selectedSuppliers = await loadSelectedSuppliers(selectedSupplierIds);
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
        supplier_name: supplier.supplier.name,
        supplier_id: supplier.supplier.id,
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

router.get('/search/progressive/:runId/stream', (req: Request, res: Response) => {
  const { runId } = req.params;
  if (!runId) {
    res.status(400).json({ error: 'runId parameter is required' });
    return;
  }

  const job = progressiveJobs.get(runId);
  if (!job) {
    res.status(404).json({ error: 'Search run not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = () => {
    const currentJob = progressiveJobs.get(runId);
    if (!currentJob) return false;
    res.write(`data: ${JSON.stringify(buildProgressPayload(currentJob))}\n\n`);
    return currentJob.done;
  };

  if (send()) {
    res.end();
    return;
  }

  const interval = setInterval(() => {
    const done = send();
    if (done) {
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => clearInterval(interval));
});

router.get('/suppliers/auth-status', async (_req: Request, res: Response) => {
  try {
    const items = await getSupplierAuthStatuses();
    return res.json({
      items,
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to fetch supplier auth status: %s', error?.message || error);
    return res.status(500).json({ error: 'Failed to fetch supplier auth status' });
  }
});

router.post('/suppliers/auth-refresh', async (req: Request, res: Response) => {
  const supplierName = String(req.body?.supplier_name || '').trim();
  try {
    const items = await refreshSupplierAuthStatuses(supplierName || undefined);
    return res.json({
      items,
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to refresh supplier auth status: %s', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to refresh supplier auth status' });
  }
});

router.post('/supplier-session/init', async (req: Request, res: Response) => {
  const supplierName = String(req.body?.supplier_name || '').trim().toUpperCase();
  const query = String(req.body?.query || '364624').trim() || '364624';
  const browserPreference = String(req.body?.browser_preference || '').trim().toLowerCase();
  const browserMode = String(req.body?.browser_mode || '').trim().toLowerCase();

  if (!supplierName) {
    return res.status(400).json({ error: 'supplier_name is required' });
  }

  try {
    const job = await startManualSupplierSessionJob(
      supplierName,
      query,
      browserPreference || undefined,
      browserMode || undefined
    );
    return res.status(202).json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      supplier_name: job.supplier_name,
      message: job.message || `Manual session initialization started for ${supplierName}.`,
    });
  } catch (error: any) {
    logger.error('[supplier-session] %s init failed: %s', supplierName, error?.message || error);
    return res.status(400).json({
      error: error?.message || `Failed to initialize ${supplierName} session`,
    });
  }
});

router.get('/supplier-session/init/:jobId', (req: Request, res: Response) => {
  const jobId = String(req.params?.jobId || '').trim();
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const job = getManualSupplierSessionJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Manual session job not found' });
  }

  return res.json(job);
});

export default router;

