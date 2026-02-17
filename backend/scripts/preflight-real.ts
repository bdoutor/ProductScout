import 'dotenv/config';
import pLimit from 'p-limit';

import { scrapeSupplier } from '../src/services/scraper';
import { closeBrowser } from '../src/providers/playwright';
import { Supplier } from '../src/types';
import { isSupabaseConfigured, supabase, trySupabasePing } from '../src/utils/supabase';

type QueryMap = Record<string, string>;

type CliOptions = {
  defaultQuery: string;
  queryMap: QueryMap;
  supplierFilter: Set<string> | null;
  requireResults: boolean;
  debug: boolean;
  concurrency: number;
};

type SupplierCheck = {
  supplierName: string;
  supplierId: string;
  query: string;
  ok: boolean;
  loginAndSearchOk: boolean;
  hasResults: boolean;
  itemsFound: number;
  status: string;
  error?: string;
};

function normalizeName(name: string): string {
  return String(name || '').trim().toLowerCase();
}

function parseQueryMap(raw: string | undefined, label: string): QueryMap {
  if (!raw || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const map: QueryMap = {};
    for (const [key, value] of Object.entries(parsed || {})) {
      if (typeof value === 'string' && value.trim()) {
        map[normalizeName(key)] = value.trim();
      }
    }
    return map;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid ${label} JSON: ${message}`);
  }
}

function parseArgs(argv: string[]): CliOptions {
  let defaultQuery = process.env.SUPPLIER_PREFLIGHT_DEFAULT_QUERY || '';
  let queryMap = parseQueryMap(process.env.SUPPLIER_PREFLIGHT_QUERIES, 'SUPPLIER_PREFLIGHT_QUERIES');
  let supplierFilter: Set<string> | null = null;
  let requireResults = true;
  let debug = true;
  let concurrency = Number(process.env.PREFLIGHT_CONCURRENCY || '1');

  for (const arg of argv) {
    if (arg.startsWith('--default-query=')) {
      defaultQuery = arg.slice('--default-query='.length).trim();
      continue;
    }
    if (arg.startsWith('--queries=')) {
      queryMap = parseQueryMap(arg.slice('--queries='.length), '--queries');
      continue;
    }
    if (arg.startsWith('--suppliers=')) {
      const values = arg
        .slice('--suppliers='.length)
        .split(',')
        .map((v) => normalizeName(v))
        .filter(Boolean);
      supplierFilter = values.length > 0 ? new Set(values) : null;
      continue;
    }
    if (arg === '--no-require-results') {
      requireResults = false;
      continue;
    }
    if (arg === '--require-results') {
      requireResults = true;
      continue;
    }
    if (arg === '--no-debug') {
      debug = false;
      continue;
    }
    if (arg === '--debug') {
      debug = true;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      const value = Number(arg.slice('--concurrency='.length));
      if (Number.isFinite(value) && value > 0) {
        concurrency = value;
      }
      continue;
    }
  }

  if (!Number.isFinite(concurrency) || concurrency < 1) {
    concurrency = 1;
  }

  return {
    defaultQuery,
    queryMap,
    supplierFilter,
    requireResults,
    debug,
    concurrency
  };
}

async function loadSelectedSuppliers(): Promise<Supplier[]> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const [{ data: creds, error: credsError }, { data: suppliers, error: suppliersError }] = await Promise.all([
    supabase.from('supplier_credentials').select('name,active').eq('active', true),
    supabase.from('suppliers').select('*').eq('enabled', true)
  ]);

  if (credsError) {
    throw new Error(`Failed to load supplier_credentials: ${credsError.message}`);
  }
  if (suppliersError) {
    throw new Error(`Failed to load suppliers: ${suppliersError.message}`);
  }

  const namesWithCredential = new Set(
    (creds || [])
      .map((row: any) => normalizeName(String(row.name || '')))
      .filter(Boolean)
  );

  return (suppliers || []).filter((supplier: Supplier) => {
    const nameKey = normalizeName(supplier.name);
    const hasCredential = namesWithCredential.has(nameKey);
    const hasInlineCreds = Boolean(supplier.login && supplier.password && (supplier.login_url || supplier.url || supplier.base_url));
    return hasCredential || hasInlineCreds;
  }) as Supplier[];
}

function resolveQueryForSupplier(supplierName: string, options: CliOptions): string {
  const normalized = normalizeName(supplierName);
  return options.queryMap[normalized] || options.defaultQuery;
}

function printHeader(options: CliOptions, supplierCount: number) {
  console.log('=== ProductScout Real Preflight ===');
  console.log(`Suppliers to check: ${supplierCount}`);
  console.log(`Require results: ${options.requireResults}`);
  console.log(`Debug snapshots: ${options.debug}`);
  console.log(`Concurrency: ${options.concurrency}`);
}

function printResult(result: SupplierCheck): void {
  const marker = result.ok ? 'OK' : 'FAIL';
  const errorSuffix = result.error ? ` error=${result.error}` : '';
  console.log(
    `[${marker}] ${result.supplierName} query="${result.query}" status=${result.status} items=${result.itemsFound} login_search_ok=${result.loginAndSearchOk} has_results=${result.hasResults}${errorSuffix}`
  );
}

async function run(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (!isSupabaseConfigured() || !supabase) {
      console.error('Supabase is not configured. Define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(2);
    }

    const ping = await trySupabasePing();
    if (!ping.ok) {
      console.error(`Supabase ping failed: ${ping.error || 'unknown error'}`);
      process.exit(2);
    }

    let suppliers = await loadSelectedSuppliers();
    if (options.supplierFilter) {
      suppliers = suppliers.filter((s) => options.supplierFilter!.has(normalizeName(s.name)));
    }

    if (suppliers.length === 0) {
      console.error('No enabled suppliers with credentials were found.');
      process.exit(2);
    }

    printHeader(options, suppliers.length);

    const limit = pLimit(options.concurrency);
    const checks = await Promise.all(
      suppliers.map((supplier) =>
        limit(async (): Promise<SupplierCheck> => {
          const query = resolveQueryForSupplier(supplier.name, options).trim();
          if (!query) {
            return {
              supplierName: supplier.name,
              supplierId: supplier.id,
              query: '',
              ok: false,
              loginAndSearchOk: false,
              hasResults: false,
              itemsFound: 0,
              status: 'error',
              error: 'Missing query (set --default-query or --queries)'
            };
          }

          try {
            const { items, searchRun } = await scrapeSupplier(supplier, query, options.debug);
            const loginAndSearchOk = searchRun.status === 'success';
            const hasResults = items.length > 0;
            const ok = loginAndSearchOk && (!options.requireResults || hasResults);
            return {
              supplierName: supplier.name,
              supplierId: supplier.id,
              query,
              ok,
              loginAndSearchOk,
              hasResults,
              itemsFound: items.length,
              status: searchRun.status,
              error: searchRun.error_message || searchRun.error_details || undefined
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              supplierName: supplier.name,
              supplierId: supplier.id,
              query,
              ok: false,
              loginAndSearchOk: false,
              hasResults: false,
              itemsFound: 0,
              status: 'error',
              error: message
            };
          }
        })
      )
    );

    checks.forEach(printResult);

    const total = checks.length;
    const okCount = checks.filter((c) => c.ok).length;
    const failed = checks.filter((c) => !c.ok);
    console.log('---');
    console.log(`Preflight summary: ${okCount}/${total} suppliers passed`);

    if (failed.length > 0) {
      const failedNames = failed.map((c) => c.supplierName).join(', ');
      console.error(`Preflight failed for: ${failedNames}`);
      process.exit(1);
    }

    console.log('Real preflight passed for all suppliers.');
  } finally {
    await closeBrowser().catch(() => {});
  }
}

run().catch((err) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`Preflight execution error: ${message}`);
  process.exit(1);
});
