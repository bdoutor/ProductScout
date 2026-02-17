import { Router, Request, Response } from 'express';

const router = Router();

// Mock data interfaces
interface MockProduct {
  title: string;
  partNumber: string;
  price: number;
  availability: string;
  delivery: string;
  url: string;
  supplier: string;
  status: 'in_stock' | 'out_of_stock';
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  query: string;
  items: MockProduct[];
  per_supplier: Array<{
    supplier_name: string;
    status: 'success' | 'error' | 'no_results';
    items_found: number;
    search_run_id: string;
    error?: string;
  }>;
}

router.post('/mock-search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    console.log('[Mock Search] Query:', query);

    const mockItems: MockProduct[] = [
      {
        title: `AUGER Part ${query}`,
        partNumber: query,
        price: 199.99,
        availability: '5 units available',
        delivery: '2-3 business days',
        url: `https://auger-shop.com/product/${query}`,
        supplier: 'AUGER',
        status: 'in_stock',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const response = {
      query,
      items: mockItems,
      per_supplier: [
        {
          supplier_name: 'AUGER',
          status: 'success',
          items_found: mockItems.length,
          search_run_id: Date.now().toString()
        }
      ]
    };

    console.log('[Mock Search] Response:', JSON.stringify(response, null, 2));
    return res.json(response);

  } catch (error) {
    console.error('[Mock Search] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;