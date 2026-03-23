import NodeCache from 'node-cache';

import { Supplier, SupplierCredential } from '../types';
import { supabase } from '../utils/supabase';
import { decryptPassword } from '../utils/secrets';
import { getProviderForSupplier } from '../providers';
import { loadSessionCache } from '../utils/session-cache';
import { getSupplierKey, getSupplierSessionCacheKey } from '../utils/supplier-utils';

export type SupplierAuthMode = 'none' | 'auto' | 'manual';

export interface SupplierSearchTarget {
  supplier: Supplier;
  credential: SupplierCredential | null;
  auth_mode: SupplierAuthMode;
  provider_available: boolean;
  session_cache_key: string;
  reusable_session: boolean;
}

interface SupplierRegistryCache {
  suppliers: Supplier[];
  credentialsByName: Map<string, SupplierCredential>;
}

const supplierRegistryCache = new NodeCache({
  stdTTL: Math.max(15, Number(process.env.SUPPLIER_REGISTRY_CACHE_TTL_S || '60')),
  checkperiod: Math.max(15, Number(process.env.SUPPLIER_REGISTRY_CACHE_TTL_S || '60')),
});

function normalizeName(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function getSupplierAuthMode(supplier: Supplier): SupplierAuthMode {
  // DB-driven: if auth_mode is set in the supplier record, prefer it
  const dbMode = String(supplier.auth_mode || '').trim().toLowerCase();
  if (dbMode === 'manual' || dbMode === 'auto' || dbMode === 'none') {
    return dbMode as SupplierAuthMode;
  }

  // Fallback: derive from code
  if (getSupplierKey(supplier) === 'gsmart') {
    return 'manual';
  }

  const provider = getProviderForSupplier(supplier);
  if (provider) {
    return 'auto';
  }

  return 'none';
}

function buildInlineCredential(supplier: Supplier): SupplierCredential | null {
  if (!supplier.login || !supplier.password) {
    return null;
  }

  return {
    id: `inline-${supplier.id}`,
    name: supplier.name,
    login: supplier.login,
    password: supplier.password,
    url: supplier.login_url || supplier.url || supplier.base_url,
    active: true,
  };
}

function resolveCredentialFromMap(
  supplier: Supplier,
  credentialsByName?: Map<string, SupplierCredential>
): SupplierCredential | null {
  const stored = credentialsByName?.get(normalizeName(supplier.name));
  if (stored?.login && stored?.password) {
    let password = String(stored.password);
    try {
      password = decryptPassword(password);
    } catch {
      // Keep stored value when decryption is not needed.
    }

    return {
      ...stored,
      password,
    };
  }

  return buildInlineCredential(supplier);
}

async function loadSupplierRegistry(forceRefresh = false): Promise<SupplierRegistryCache> {
  const cacheKey = 'supplier-registry';
  if (!forceRefresh) {
    const cached = supplierRegistryCache.get<SupplierRegistryCache>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!supabase) {
    return {
      suppliers: [],
      credentialsByName: new Map<string, SupplierCredential>(),
    };
  }

  const [{ data: suppliers, error: suppliersError }, { data: credentials, error: credentialsError }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('enabled', true),
    supabase.from('supplier_credentials').select('*').eq('active', true),
  ]);

  if (suppliersError) {
    throw new Error(`Failed to load suppliers: ${suppliersError.message}`);
  }
  if (credentialsError) {
    throw new Error(`Failed to load supplier credentials: ${credentialsError.message}`);
  }

  const registry: SupplierRegistryCache = {
    suppliers: (suppliers || []) as Supplier[],
    credentialsByName: new Map<string, SupplierCredential>(),
  };

  (credentials || []).forEach((credential: any) => {
    const key = normalizeName(credential?.name);
    if (key) {
      registry.credentialsByName.set(key, credential as SupplierCredential);
    }
  });

  supplierRegistryCache.set(cacheKey, registry);
  return registry;
}

export async function resolveRuntimeCredential(
  supplier: Supplier,
  credentialsByName?: Map<string, SupplierCredential>
): Promise<SupplierCredential | null> {
  if (credentialsByName) {
    return resolveCredentialFromMap(supplier, credentialsByName);
  }

  const registry = await loadSupplierRegistry(false);
  return resolveCredentialFromMap(supplier, registry.credentialsByName);
}

export function hasReusableSession(target: Pick<SupplierSearchTarget, 'auth_mode' | 'session_cache_key'>): boolean {
  if (target.auth_mode !== 'manual') {
    return false;
  }

  const cached = loadSessionCache(target.session_cache_key);
  return Array.isArray(cached) && cached.length > 0;
}

export function buildSupplierWarmupSearchUrl(supplier: Supplier, query?: string): string {
  const warmupQuery = String(query || process.env.SUPPLIER_WARMUP_QUERY || '364624').trim() || '364624';
  return supplier.search_url_template.replace('{query}', encodeURIComponent(warmupQuery));
}

export async function loadEnabledSupplierTargets(
  forceRefresh = false
): Promise<SupplierSearchTarget[]> {
  const registry = await loadSupplierRegistry(forceRefresh);

  return registry.suppliers.map((supplier) => {
    const credential = resolveCredentialFromMap(supplier, registry.credentialsByName);
    const authMode = getSupplierAuthMode(supplier);
    const sessionCacheKey = getSupplierSessionCacheKey(supplier);
    const providerAvailable = Boolean(getProviderForSupplier(supplier));
    const cachedSession = providerAvailable ? loadSessionCache(sessionCacheKey) : null;
    const reusableSession = Array.isArray(cachedSession) && cachedSession.length > 0;

    return {
      supplier,
      credential: credential || null,
      auth_mode: authMode,
      provider_available: providerAvailable,
      session_cache_key: sessionCacheKey,
      reusable_session: reusableSession,
    };
  });
}

export function invalidateSupplierRegistryCache(): void {
  supplierRegistryCache.del('supplier-registry');
}
