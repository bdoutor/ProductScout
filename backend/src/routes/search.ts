import { Router, Request, Response } from 'express';
import pLimit from 'p-limit';
import NodeCache from 'node-cache';
import { supabase } from '../utils/supabase';
import { scrapeSupplier } from '../services/scraper';
import { sortItems } from '../utils/parser';
import { Supplier, SearchResponse, SupplierResult } from '../types';

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
    // Fetch all enabled suppliers
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('enabled', true);

    if (suppliersError) {
      throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);
    }

    if (!suppliers || suppliers.length === 0) {
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
          delivery: 'Indisponível',
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
    const results = await Promise.all(
      suppliers.map((supplier: Supplier) =>
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
            const result = await scrapeSupplier(supplier, query, debug);

            // Cache successful results
            if (result.searchRun.status === 'success') {
              cache.set(cacheKey, result);
            }

            return {
              supplier,
              items: result.items,
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
    const allItems = results.flatMap(r => r.items);
    const sortedItems = sortItems(allItems);

    const perSupplier: SupplierResult[] = results.map(r => ({
      supplier_name: r.supplier.name,
      status: r.searchRun.status as 'success' | 'error',
      items_found: r.items.length,
      search_run_id: r.searchRun.id,
      error_message: r.searchRun.error_message || undefined
    }));

    const availableCount = sortedItems.filter(item => (item.availability ?? 0) > 0).length;
    const errorCount = perSupplier.filter(s => s.status === 'error').length;

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
          name: `Arroz Integral Biológico 1kg - ${query}`,
          code: 'DEMO004',
          price: 4.99,
          availability: 0,
          delivery: 'Indisponível',
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
        message: '⚠️ All real suppliers failed. Showing demo data. Configure correct CSS selectors in Supabase for real results.'
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
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplier_id)
      .single();

    if (supplierError || !supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Scrape with debug enabled
    const result = await scrapeSupplier(supplier, query, debug);

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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
