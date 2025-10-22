import { Router, Request, Response } from 'express';
import pLimit from 'p-limit';
import NodeCache from 'node-cache';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { scrapeSupplier } from '../services/scraper';
import { sortItems } from '../utils/parser';
import { Supplier, SearchResponse, SupplierResult, SupplierCredential } from '../types';

const router = Router();

// Cache with configurable TTL
const cacheTTL = parseInt(process.env.CACHE_TTL_SECONDS || '600', 10);
const cache = new NodeCache({ stdTTL: cacheTTL });

// Rate limiting
const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10);
const limit = pLimit(maxConcurrent);

/**
 * POST /api/search
 * Search all enabled suppliers for the given query
 */
router.post('/search', async (req: Request, res: Response) => {
  const { query, debug = false } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    if (!isSupabaseConfigured()) {
      const mockItems = [
        {
          name: `Arroz Carolino Extra 1kg - ${query}`,
          code: 'MOCK001',
          price: 1.99,
          availability: 10,
          delivery: '2-3 dias',
          url: 'https://example.com/product1',
          store: 'Loja de Teste'
        },
        {
          name: `Arroz Agulha 1kg - ${query}`,
          code: 'MOCK002',
          price: 2.49,
          availability: 5,
          delivery: '1-2 dias',
          url: 'https://example.com/product2',
          store: 'Loja de Teste'
        },
        {
          name: `Arroz Integral 500g - ${query}`,
          code: 'MOCK003',
          price: 1.79,
          availability: 0,
          delivery: 'IndisponÃ­vel',
          url: 'https://example.com/product3',
          store: 'Loja de Teste'
        }
      ];

      return res.status(200).json({
        query,
        items: mockItems,
        per_supplier: [
          {
            supplier_name: 'Loja de Teste (Mock)',
            status: 'success' as const,
            items_found: mockItems.length,
            search_run_id: 'mock-run-id'
          }
        ],
        message: 'Supabase nÃ£o configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para resultados reais.'
      });
    }
    const sb = supabase!;
    // Fetch active supplier credentials
    const { data: creds, error: credsError } = await sb
      .from('supplier_credentials')
      .select('*')
      .eq('active', true);

    if (credsError) {
      throw new Error(`Failed to fetch supplier credentials: ${credsError.message}`);
    }

    // Fetch supplier scraping configs
    const { data: suppliers, error: suppliersError } = await sb
      .from('suppliers')
      .select('*')
      .eq('enabled', true);

    if (suppliersError) {
      throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);
    }

    // Select suppliers that either have an active credential OR have inline login/password (legacy) in suppliers table
    const allowedNames = new Set((creds || []).map((c: any) => String(c.name).toLowerCase().trim()));
    const selected = (suppliers || []).filter((s: any) => {
      const nameKey = String(s.name).toLowerCase().trim();
      const hasCred = allowedNames.has(nameKey);
      const hasInline = Boolean(s.login && s.password && (s.login_url || s.url || s.base_url));
      return hasCred || hasInline;
    });

    if (!selected || selected.length === 0) {
      // Return mock data for testing when no suppliers are configured
      const mockItems = [
        {
          name: `Arroz Carolino Extra 1kg - ${query}`,
          code: 'MOCK001',
          price: 1.99,
          availability: 10,
          delivery: '2-3 dias',
          url: 'https://example.com/product1',
          store: 'Loja de Teste'
        },
        {
          name: `Arroz Agulha 1kg - ${query}`,
          code: 'MOCK002',
          price: 2.49,
          availability: 5,
          delivery: '1-2 dias',
          url: 'https://example.com/product2',
          store: 'Loja de Teste'
        },
        {
          name: `Arroz Integral 500g - ${query}`,
          code: 'MOCK003',
          price: 1.79,
          availability: 0,
          delivery: 'IndisponÃ­vel',
          url: 'https://example.com/product3',
          store: 'Loja de Teste'
        }
      ];

      return res.status(200).json({
        query,
        items: mockItems,
        per_supplier: [
          {
            supplier_name: 'Loja de Teste (Mock)',
            status: 'success' as const,
            items_found: mockItems.length,
            search_run_id: 'mock-run-id'
          }
        ],
        message: 'Showing mock data - Configure suppliers in Supabase to get real results'
      });
    }

    // Scrape all suppliers in parallel (with concurrency limit)
    // Build credential map by supplier name (case-insensitive)
    const credMap = new Map<string, SupplierCredential>();
    (creds || []).forEach((c: any) => credMap.set(String(c.name).toLowerCase().trim(), c as SupplierCredential));
    // Fallback: build runtime credentials from suppliers table (plaintext) when no credential exists
    (selected as any[]).forEach((s: any) => {
      const key = String(s.name).toLowerCase().trim();
      if (!credMap.has(key) && s.login && s.password) {
        credMap.set(key, {
          id: `inline-${s.id}`,
          name: s.name,
          login: String(s.login),
          password: String(s.password),
          url: (s.login_url || s.url || s.base_url) as string,
          active: true,
          created_at: '',
          updated_at: ''
        } as any);
      }
    });

    // Helper to resolve credential by name or by matching domain with supplier URLs
    const credsList: SupplierCredential[] = (creds || []) as any;
    const getHost = (u?: string | null): string | null => {
      try {
        if (!u) return null;
        const h = new URL(String(u)).host.toLowerCase();
        return h.startsWith('www.') ? h.slice(4) : h;
      } catch { return null; }
    };
    const resolveCredential = (s: Supplier): SupplierCredential | undefined => {
      const nameKey = String(s.name).toLowerCase().trim();
      const byName = credMap.get(nameKey);
      if (byName) return byName;
      const sHosts = [getHost((s as any).login_url), getHost((s as any).url), getHost((s as any).base_url)].filter(Boolean) as string[];
      if (sHosts.length === 0) return undefined;
      for (const c of credsList) {
        const cHost = getHost((c as any).url);
        if (cHost && sHosts.some(h => h === cHost || h?.endsWith('.' + cHost) || cHost?.endsWith('.' + h))) {
          return c;
        }
      }
      return undefined;
    };

    const results = await Promise.all(
      selected.map((supplier: Supplier) =>
        limit(async () => {
          const cacheKey = `${query}:${supplier.id}`;

          // Check cache
          const cached = cache.get<{ items: any[]; searchRun: any }>(cacheKey);
          if (cached && !debug) {
            return {
              supplier,
              items: cached.items,
              searchRun: cached.searchRun
            };
          }

          // Add delay to be polite
          const delay = parseInt(process.env.REQUEST_DELAY_MS || '1000', 10);
          await new Promise(resolve => setTimeout(resolve, Math.random() * delay));

          try {
            const cred = resolveCredential(supplier);
            // When using encrypted passwords, decrypt before passing
            let runtimeCred: SupplierCredential | undefined = undefined;
            if (cred) {
              try {
                const { decryptPassword } = await import('../utils/secrets');
                const decrypted = decryptPassword((cred as any).password);
                runtimeCred = { ...cred, password: decrypted } as SupplierCredential;
              } catch {
                runtimeCred = cred as SupplierCredential; // pass as-is if decrypt fails
              }
            }

            const result = await scrapeSupplier(supplier, query, debug, runtimeCred);

            // Enforce per-supplier item limit (10 cheapest first), then fill with items without price
            const limitPerSupplier = parseInt(process.env.SUPPLIER_ITEM_LIMIT || '10', 10);
            let limitedItems = result.items;
            if (Number.isFinite(limitPerSupplier) && limitPerSupplier > 0) {
              try {
                const priced = result.items.filter(i => i.price !== null && i.price !== undefined)
                  .sort((a, b) => (a.price! - b.price!));
                const withoutPrice = result.items.filter(i => i.price === null || i.price === undefined);
                const combined = priced.concat(withoutPrice);
                limitedItems = combined.slice(0, limitPerSupplier);
              } catch {
                limitedItems = result.items.slice(0, limitPerSupplier);
              }
            }

            // Cache successful results
            if (result.searchRun.status === 'success') {
              cache.set(cacheKey, result);
            }

            return {
              supplier,
              items: limitedItems,
              searchRun: result.searchRun
            };
          } catch (error: any) {
            console.error(`Error scraping ${supplier.name}:`, error);
            return {
              supplier,
              items: [],
              searchRun: {
                status: 'error',
                error_message: 'UNKNOWN_ERROR',
                error_details: error.message
              }
            };
          }
        })
      )
    );

    // Aggregate results
    let allItems = results.flatMap(r => r.items);
    let sortedItems = sortItems(allItems);

    const perSupplier: SupplierResult[] = results.map(r => ({
      supplier_name: r.supplier.name,
      status: r.searchRun.status as 'success' | 'error',
      items_found: r.items.length,
      search_run_id: r.searchRun.id,
      error_message: r.searchRun.error_message || undefined
    }));

    const availableCount = sortedItems.filter(item => (item.availability ?? 0) > 0).length;
    const errorCount = perSupplier.filter(s => s.status === 'error').length;

    // If no items but AUGER available, try a focused retry for AUGER only
    if (sortedItems.length === 0) {
      try {
        const augerResult = results.find(r => String(r.supplier.name).toLowerCase().includes('auger'));
        if (augerResult) {
          const retrySupplier = augerResult.supplier as Supplier;
          const cred = resolveCredential(retrySupplier);
          let runtimeCred: SupplierCredential | undefined = undefined;
          if (cred) {
            try {
              const { decryptPassword } = await import('../utils/secrets');
              const decrypted = decryptPassword((cred as any).password);
              runtimeCred = { ...cred, password: decrypted } as SupplierCredential;
            } catch { runtimeCred = cred as SupplierCredential; }
          }
          const retry = await scrapeSupplier(retrySupplier, query, false, runtimeCred);
          if (retry?.items?.length) {
            // Replace AUGER entry and items
            allItems = retry.items;
            sortedItems = sortItems(allItems);
            // Update per supplier status
            const idx = results.findIndex(r => String(r.supplier.name).toLowerCase().includes('auger'));
            if (idx >= 0) {
              results[idx] = { supplier: retrySupplier, items: retry.items, searchRun: retry.searchRun } as any;
            }
          }
        }
      } catch { }
    }

    // If all suppliers failed, return mock data for demonstration
    if (sortedItems.length === 0 && errorCount === perSupplier.length) {
      const mockItems = [
        {
          name: `Arroz Carolino Extra 1kg - ${query}`,
          code: 'DEMO001',
          price: 1.99,
          availability: 10,
          delivery: '2-3 dias',
          url: 'https://example.com/product1',
          store: 'Demo Store'
        },
        {
          name: `Arroz Agulha 1kg - ${query}`,
          code: 'DEMO002',
          price: 2.49,
          availability: 5,
          delivery: '1-2 dias',
          url: 'https://example.com/product2',
          store: 'Demo Store'
        },
        {
          name: `Arroz Basmati 500g - ${query}`,
          code: 'DEMO003',
          price: 3.99,
          availability: 8,
          delivery: '3-5 dias',
          url: 'https://example.com/product3',
          store: 'Demo Store'
        },
        {
          name: `Arroz Integral BiolÃ³gico 1kg - ${query}`,
          code: 'DEMO004',
          price: 4.99,
          availability: 0,
          delivery: 'IndisponÃ­vel',
          url: 'https://example.com/product4',
          store: 'Demo Store'
        }
      ];

      perSupplier.push({
        supplier_name: 'Demo Store (Fallback)',
        status: 'success',
        items_found: mockItems.length,
        search_run_id: 'demo-fallback'
      });

      return res.json({
        query,
        items: mockItems,
        per_supplier: perSupplier,
        message: 'âš ï¸ All real suppliers failed. Showing demo data. Configure correct CSS selectors in Supabase for real results.'
      });
    }

    const response: SearchResponse = {
      query,
      items: sortedItems,
      per_supplier: perSupplier
    };

    if (availableCount === 0 && sortedItems.length > 0) {
      response.message = 'No available items found, showing all results';
    } else if (sortedItems.length === 0) {
      response.message = 'No products found';
    }

    res.json(response);
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/test-supplier
 * Test a single supplier with full diagnostics
 */
router.post('/test-supplier', async (req: Request, res: Response) => {
  const { supplier_id, query, debug = true } = req.body;

  if (!supplier_id || !query) {
    return res.status(400).json({ error: 'supplier_id and query are required' });
  }

  try {
    // Fetch supplier
    const sb = supabase!;
    const { data: supplier, error: supplierError } = await sb
      .from('suppliers')
      .select('*')
      .eq('id', supplier_id)
      .single();

    if (supplierError || !supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Resolve credentials (by name and by domain) and decrypt password if needed
    const { data: creds } = await supabase!
      .from('supplier_credentials')
      .select('*')
      .eq('active', true);

    const allowed = new Map<string, any>();
    (creds || []).forEach((c: any) => allowed.set(String(c.name).toLowerCase().trim(), c));

    const getHost = (u?: string | null): string | null => {
      try { if (!u) return null; const h = new URL(String(u)).host.toLowerCase(); return h.startsWith('www.') ? h.slice(4) : h; } catch { return null; }
    };
    const resolveCred = (): any | undefined => {
      const byName = allowed.get(String(supplier.name).toLowerCase().trim());
      if (byName) return byName;
      const sHosts = [getHost((supplier as any).login_url), getHost((supplier as any).url), getHost((supplier as any).base_url)].filter(Boolean) as string[];
      for (const c of (creds || [])) {
        const ch = getHost((c as any).url);
        if (ch && sHosts.some(h => h === ch || h?.endsWith('.' + ch) || ch?.endsWith('.' + h))) return c;
      }
      return undefined;
    };
    let runtimeCred: any | undefined = undefined;
    const cred = resolveCred();
    if (cred) {
      try {
        const { decryptPassword } = await import('../utils/secrets');
        runtimeCred = { ...cred, password: decryptPassword(String(cred.password || '')) } as any;
      } catch { runtimeCred = cred as any; }
    }

    // Scrape with debug enabled and runtime credential when available
    const result = await scrapeSupplier(supplier, query, debug, runtimeCred as any);

    res.json({
      search_run: result.searchRun,
      items: result.items
    });
  } catch (error: any) {
    console.error('Test supplier error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/search-runs/:id
 * Get details of a specific search run
 */
router.get('/search-runs/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const sb = supabase!;
    const { data, error } = await sb
      .from('search_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Search run not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Get search run error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/suppliers
 * List all suppliers
 */
router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const sb = supabase!;
    const { data, error } = await sb
      .from('suppliers')
      .select('*')
      .order('name');

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;

