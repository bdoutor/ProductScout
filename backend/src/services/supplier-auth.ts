import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { getProviderForSupplier } from '../providers';
import { loadSessionCache } from '../utils/session-cache';
import { initializeManualSupplierSession } from './supplier-session';
import {
  SupplierSearchTarget,
  buildSupplierWarmupSearchUrl,
  hasReusableSession,
  loadEnabledSupplierTargets,
} from './supplier-runtime';

export type SupplierAuthState = 'READY' | 'CHECKING' | 'MANUAL_REQUIRED' | 'ERROR' | 'DISABLED';

export interface SupplierAuthStatus {
  supplier_id: string;
  supplier_name: string;
  state: SupplierAuthState;
  reason_code?: string | null;
  reason_text?: string | null;
  manual_supported: boolean;
  last_check_at?: string | null;
  next_refresh_at?: string | null;
}

export interface SupplierManualSessionJob {
  job_id: string;
  supplier_name: string;
  status: 'queued' | 'running' | 'success' | 'error';
  message?: string;
  error?: string;
  started_at: string;
  updated_at: string;
  finished_at?: string | null;
}

interface SupplierAuthStatusInternal extends SupplierAuthStatus {
  last_check_ts: number;
  next_refresh_ts: number;
}

const READY_REFRESH_MS = Math.max(5 * 60 * 1000, Number(process.env.SUPPLIER_AUTH_READY_REFRESH_MS || `${15 * 60 * 1000}`));
const MANUAL_REQUIRED_REFRESH_MS = Math.max(60 * 1000, Number(process.env.SUPPLIER_AUTH_MANUAL_REFRESH_MS || `${5 * 60 * 1000}`));
const ERROR_REFRESH_MS = Math.max(60 * 1000, Number(process.env.SUPPLIER_AUTH_ERROR_REFRESH_MS || `${5 * 60 * 1000}`));
const SCHEDULER_TICK_MS = Math.max(60 * 1000, Number(process.env.SUPPLIER_AUTH_SCHEDULER_TICK_MS || '60000'));
const JOB_PRESERVE_MS = Math.max(15 * 60 * 1000, Number(process.env.SUPPLIER_AUTH_JOB_PRESERVE_MS || `${60 * 60 * 1000}`));
const SILENT_REFRESH_TIMEOUT_MS = Math.max(10000, Number(process.env.SUPPLIER_AUTH_SILENT_REFRESH_TIMEOUT_MS || '25000'));

const statusBySupplierId = new Map<string, SupplierAuthStatusInternal>();
const supplierCache = new Map<string, SupplierSearchTarget>();
const refreshLocks = new Set<string>();
const manualJobBySupplier = new Map<string, string>();
const manualJobs = new Map<string, SupplierManualSessionJob>();

let schedulerStarted = false;
let schedulerRunning = false;
let initPromise: Promise<void> | null = null;

function nowIso(ts = Date.now()): string {
  return new Date(ts).toISOString();
}

function normalizeName(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function isManualSupplier(target: SupplierSearchTarget): boolean {
  return target.auth_mode === 'manual';
}

function canSilentlyRefreshTarget(target: SupplierSearchTarget): boolean {
  return (
    target.auth_mode === 'auto' &&
    target.provider_available &&
    Boolean(target.credential?.login && target.credential?.password)
  );
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

function nextRefreshMsForState(state: SupplierAuthState): number {
  if (state === 'READY') return READY_REFRESH_MS;
  if (state === 'MANUAL_REQUIRED') return MANUAL_REQUIRED_REFRESH_MS;
  if (state === 'ERROR') return ERROR_REFRESH_MS;
  return MANUAL_REQUIRED_REFRESH_MS;
}

function toPublicStatus(status: SupplierAuthStatusInternal): SupplierAuthStatus {
  return {
    supplier_id: status.supplier_id,
    supplier_name: status.supplier_name,
    state: status.state,
    reason_code: status.reason_code || null,
    reason_text: status.reason_text || null,
    manual_supported: status.manual_supported,
    last_check_at: status.last_check_ts ? nowIso(status.last_check_ts) : null,
    next_refresh_at: status.next_refresh_ts ? nowIso(status.next_refresh_ts) : null,
  };
}

function evaluateSupplierStatus(target: SupplierSearchTarget): SupplierAuthStatusInternal {
  const now = Date.now();
  const previous = statusBySupplierId.get(target.supplier.id);

  let state: SupplierAuthState = 'READY';
  let reasonCode: string | null = null;
  let reasonText: string | null = null;
  let manualSupported = false;

  if (isManualSupplier(target)) {
    manualSupported = true;
    if (!hasReusableSession(target)) {
      state = 'MANUAL_REQUIRED';
      reasonCode = 'GSMART_SESSION_EXPIRED';
      reasonText = 'Manual login required (captcha).';
    }
  } else if (target.auth_mode === 'auto' && (!target.credential || !target.credential.login || !target.credential.password)) {
    state = 'ERROR';
    reasonCode = 'NO_CREDENTIALS';
    reasonText = 'Supplier credentials are missing or inactive.';
  } else if (refreshLocks.has(target.supplier.id)) {
    state = 'CHECKING';
    reasonCode = 'SESSION_REFRESH_PENDING';
    reasonText = 'Refreshing session silently.';
  } else if (previous?.state === 'ERROR' && target.auth_mode !== 'manual') {
    state = 'ERROR';
    reasonText = previous.reason_text || null;
    reasonCode = previous.reason_code || null;
  } else if (target.auth_mode === 'auto' && target.provider_available) {
    state = 'READY';
    reasonCode = target.reusable_session ? null : 'SESSION_REFRESH_SCHEDULED';
    reasonText = target.reusable_session ? null : 'Silent refresh scheduled.';
  }

  return {
    supplier_id: target.supplier.id,
    supplier_name: target.supplier.name,
    state,
    reason_code: reasonCode,
    reason_text: reasonText,
    manual_supported: manualSupported,
    last_check_at: nowIso(now),
    next_refresh_at: nowIso(now + nextRefreshMsForState(state)),
    last_check_ts: now,
    next_refresh_ts: now + nextRefreshMsForState(state),
    ...(previous ? {} : {}),
  };
}

async function silentlyRefreshSupplierSession(target: SupplierSearchTarget): Promise<SupplierAuthStatusInternal> {
  const provider = getProviderForSupplier(target.supplier);
  if (!provider || !target.credential) {
    return evaluateSupplierStatus(target);
  }

  const refreshUrl = buildSupplierWarmupSearchUrl(target.supplier);
  const result = await withTimeout(
    provider.loginAndFetch(
      target.supplier,
      target.credential,
      refreshUrl,
      SILENT_REFRESH_TIMEOUT_MS
    ),
    SILENT_REFRESH_TIMEOUT_MS + 5000,
    `${target.supplier.name.toUpperCase()}_SILENT_REFRESH`
  );

  if (result.error) {
    throw result.error;
  }

  const refreshed: SupplierSearchTarget = {
    ...target,
    reusable_session: true,
  };
  const ts = Date.now();

  return {
    supplier_id: refreshed.supplier.id,
    supplier_name: refreshed.supplier.name,
    state: 'READY',
    reason_code: null,
    reason_text: null,
    manual_supported: false,
    last_check_at: nowIso(ts),
    next_refresh_at: nowIso(ts + READY_REFRESH_MS),
    last_check_ts: ts,
    next_refresh_ts: ts + READY_REFRESH_MS,
  };
}

async function reloadAllStatuses(forceRefresh = false): Promise<void> {
  const rows = await loadEnabledSupplierTargets(forceRefresh);
  supplierCache.clear();

  const activeIds = new Set<string>();
  rows.forEach((target) => {
    supplierCache.set(target.supplier.id, target);
    activeIds.add(target.supplier.id);
    const status = evaluateSupplierStatus(target);
    statusBySupplierId.set(target.supplier.id, status);
  });

  for (const existingId of Array.from(statusBySupplierId.keys())) {
    if (!activeIds.has(existingId)) {
      statusBySupplierId.delete(existingId);
    }
  }

  // Fire refreshes sequentially to avoid parallel Playwright browser contention.
  // refreshDueStatuses() is already sequential; keep the same behaviour here.
  void (async () => {
    for (const target of rows.filter(
      (t) => canSilentlyRefreshTarget(t) && !t.reusable_session
    )) {
      if (!refreshLocks.has(target.supplier.id)) {
        await refreshSupplierById(target.supplier.id);
      }
    }
  })();
}

async function ensureInitialized(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await reloadAllStatuses();
  })()
    .catch((err) => {
      logger.error('[supplier-auth] initialization failed: %s', err instanceof Error ? err.message : String(err));
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}

async function refreshSupplierById(supplierId: string): Promise<void> {
  if (refreshLocks.has(supplierId)) {
    return;
  }
  const cached = supplierCache.get(supplierId);
  if (!cached) {
    return;
  }

  refreshLocks.add(supplierId);
  const previous = statusBySupplierId.get(supplierId);
  const now = Date.now();

  if (previous) {
    statusBySupplierId.set(supplierId, {
      ...previous,
      state: 'CHECKING',
      reason_code: 'SESSION_REFRESH_PENDING',
      reason_text: 'Refreshing session silently.',
      last_check_ts: now,
      last_check_at: nowIso(now),
      next_refresh_ts: now + 60 * 1000,
      next_refresh_at: nowIso(now + 60 * 1000),
    });
  }

  try {
    const evaluated = canSilentlyRefreshTarget(cached)
      ? await silentlyRefreshSupplierSession(cached)
      : evaluateSupplierStatus(cached);
    if (evaluated.state === 'READY' && canSilentlyRefreshTarget(cached)) {
      supplierCache.set(supplierId, { ...cached, reusable_session: true });
    }
    statusBySupplierId.set(supplierId, evaluated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback = statusBySupplierId.get(supplierId);
    const ts = Date.now();
    const cachedSession = loadSessionCache(cached.session_cache_key);
    const hasReusableSession = Array.isArray(cachedSession) && cachedSession.length > 0;
    if (hasReusableSession && canSilentlyRefreshTarget(cached)) {
      supplierCache.set(supplierId, { ...cached, reusable_session: true });
      statusBySupplierId.set(supplierId, {
        supplier_id: cached.supplier.id,
        supplier_name: cached.supplier.name,
        state: 'READY',
        reason_code: 'SESSION_CACHE_AVAILABLE',
        reason_text: 'Session cache refreshed. Search validation can continue on demand.',
        manual_supported: false,
        last_check_at: nowIso(ts),
        next_refresh_at: nowIso(ts + READY_REFRESH_MS),
        last_check_ts: ts,
        next_refresh_ts: ts + READY_REFRESH_MS,
        ...(fallback ? {} : {}),
      });
      refreshLocks.delete(supplierId);
      return;
    }
    if (canSilentlyRefreshTarget(cached)) {
      supplierCache.set(supplierId, { ...cached, reusable_session: false });
    }
    statusBySupplierId.set(supplierId, {
      supplier_id: cached.supplier.id,
      supplier_name: cached.supplier.name,
      state: 'ERROR',
      reason_code: 'AUTH_REFRESH_FAILED',
      reason_text: message,
      manual_supported: isManualSupplier(cached),
      last_check_at: nowIso(ts),
      next_refresh_at: nowIso(ts + ERROR_REFRESH_MS),
      last_check_ts: ts,
      next_refresh_ts: ts + ERROR_REFRESH_MS,
      ...(fallback ? {} : {}),
    });
  } finally {
    refreshLocks.delete(supplierId);
  }
}

async function refreshDueStatuses(): Promise<void> {
  const now = Date.now();
  const dueIds = Array.from(statusBySupplierId.values())
    .filter((status) => status.next_refresh_ts <= now && !manualJobBySupplier.has(status.supplier_name.toUpperCase()))
    .map((status) => status.supplier_id);

  for (const supplierId of dueIds) {
    await refreshSupplierById(supplierId);
  }
}

function cleanupManualJobs() {
  const threshold = Date.now() - JOB_PRESERVE_MS;
  for (const [jobId, job] of manualJobs.entries()) {
    const updatedTs = Date.parse(job.updated_at || '');
    if (!Number.isNaN(updatedTs) && updatedTs < threshold && job.status !== 'running' && job.status !== 'queued') {
      manualJobs.delete(jobId);
    }
  }
}

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    // Prevent overlapping ticks: if the previous tick is still running (e.g. sequential
    // Playwright refreshes for 5 suppliers), skip this tick entirely.
    if (schedulerRunning) {
      logger.debug('[supplier-auth] scheduler tick skipped (previous tick still running)');
      return;
    }
    schedulerRunning = true;
    try {
      await ensureInitialized();
      await refreshDueStatuses();
      cleanupManualJobs();
    } catch (err) {
      logger.warn('[supplier-auth] scheduler tick failed: %s', err instanceof Error ? err.message : String(err));
    } finally {
      schedulerRunning = false;
    }
  }, SCHEDULER_TICK_MS).unref?.();
}

function setStatusBySupplierName(
  supplierName: string,
  updater: (current: SupplierAuthStatusInternal) => SupplierAuthStatusInternal
) {
  const normalized = normalizeName(supplierName);
  for (const entry of statusBySupplierId.values()) {
    if (normalizeName(entry.supplier_name) === normalized) {
      statusBySupplierId.set(entry.supplier_id, updater(entry));
      return;
    }
  }
}

/** Synchronous read of the cached auth state for a single supplier. Returns null if unknown. */
export function getSupplierAuthStateCached(supplierId: string): SupplierAuthState | null {
  return statusBySupplierId.get(supplierId)?.state ?? null;
}

export async function getSupplierAuthStatuses(): Promise<SupplierAuthStatus[]> {
  startScheduler();
  await ensureInitialized();
  return Array.from(statusBySupplierId.values())
    .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name))
    .map(toPublicStatus);
}

export async function refreshSupplierAuthStatuses(supplierName?: string): Promise<SupplierAuthStatus[]> {
  startScheduler();
  await ensureInitialized();

  if (!supplierName) {
    await reloadAllStatuses(true);
  } else {
    const normalized = normalizeName(supplierName);
    const target = Array.from(statusBySupplierId.values()).find((status) => normalizeName(status.supplier_name) === normalized);
    if (!target) {
      throw new Error(`Supplier not found or disabled: ${supplierName}`);
    }
    await refreshSupplierById(target.supplier_id);
  }

  return getSupplierAuthStatuses();
}

function runManualJob(
  jobId: string,
  supplierName: string,
  query: string,
  browserPreference?: string,
  browserMode?: string
) {
  setImmediate(async () => {
    const startTs = Date.now();
    try {
      manualJobs.set(jobId, {
        job_id: jobId,
        supplier_name: supplierName,
        status: 'running',
        message: 'Manual login in progress. Complete captcha/login in the opened browser window.',
        started_at: nowIso(startTs),
        updated_at: nowIso(startTs),
        finished_at: null,
      });

      setStatusBySupplierName(supplierName, (current) => {
        const now = Date.now();
        return {
          ...current,
          state: 'CHECKING',
          reason_code: 'MANUAL_LOGIN_IN_PROGRESS',
          reason_text: 'Manual login in progress.',
          last_check_ts: now,
          last_check_at: nowIso(now),
          next_refresh_ts: now + 60 * 1000,
          next_refresh_at: nowIso(now + 60 * 1000),
        };
      });

      await initializeManualSupplierSession(supplierName, query, browserPreference, browserMode);
      await refreshSupplierAuthStatuses(supplierName);

      manualJobs.set(jobId, {
        job_id: jobId,
        supplier_name: supplierName,
        status: 'success',
        message: `${supplierName} session initialized successfully.`,
        started_at: nowIso(startTs),
        updated_at: nowIso(),
        finished_at: nowIso(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const reasonCode = message.startsWith('CAPTCHA_REQUIRED')
        ? 'GSMART_SESSION_EXPIRED'
        : 'MANUAL_LOGIN_FAILED';
      setStatusBySupplierName(supplierName, (current) => {
        const now = Date.now();
        return {
          ...current,
          state: 'MANUAL_REQUIRED',
          reason_code: reasonCode,
          reason_text: message,
          last_check_ts: now,
          last_check_at: nowIso(now),
          next_refresh_ts: now + MANUAL_REQUIRED_REFRESH_MS,
          next_refresh_at: nowIso(now + MANUAL_REQUIRED_REFRESH_MS),
        };
      });

      manualJobs.set(jobId, {
        job_id: jobId,
        supplier_name: supplierName,
        status: 'error',
        message: 'Manual session initialization failed.',
        error: message,
        started_at: nowIso(startTs),
        updated_at: nowIso(),
        finished_at: nowIso(),
      });
    } finally {
      manualJobBySupplier.delete(supplierName.toUpperCase());
    }
  });
}

export async function startManualSupplierSessionJob(
  supplierName: string,
  query = '364624',
  browserPreference?: string,
  browserMode?: string
): Promise<SupplierManualSessionJob> {
  startScheduler();
  await ensureInitialized();

  const normalizedSupplier = String(supplierName || '').trim().toUpperCase();
  if (!normalizedSupplier) {
    throw new Error('supplier_name is required');
  }
  if (normalizedSupplier !== 'GSMART') {
    throw new Error(`Manual session init not supported for ${normalizedSupplier}`);
  }

  const runningJobId = manualJobBySupplier.get(normalizedSupplier);
  if (runningJobId) {
    const existing = manualJobs.get(runningJobId);
    if (existing) return existing;
  }

  const jobId = randomUUID();
  const queued: SupplierManualSessionJob = {
    job_id: jobId,
    supplier_name: normalizedSupplier,
    status: 'queued',
    message: 'Queued. Opening browser for manual login.',
    started_at: nowIso(),
    updated_at: nowIso(),
    finished_at: null,
  };

  manualJobs.set(jobId, queued);
  manualJobBySupplier.set(normalizedSupplier, jobId);
  runManualJob(jobId, normalizedSupplier, query, browserPreference, browserMode);
  return queued;
}

export function getManualSupplierSessionJob(jobId: string): SupplierManualSessionJob | null {
  return manualJobs.get(jobId) || null;
}

export function startSupplierAuthScheduler(): void {
  startScheduler();
}
