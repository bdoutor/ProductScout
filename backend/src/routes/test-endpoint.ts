import { Router, Request, Response } from 'express';
import { SearchResponse } from '../types';

const router = Router();

router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, debug = false } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Retornar dados mock para teste
    const mockResponse: SearchResponse = {
      query,
      items: [
        {
          name: `AUGER Part ${query}`,
          code: query,
          price: 199.99,
          availability: 5,
          delivery: '2-3 business days',
          url: `https://auger-shop.com/product/${query}`,
          store: 'AUGER Shop'
        }
      ],
      per_supplier: [
        {
          supplier_name: 'AUGER',
          status: 'success',
          items_found: 1,
          search_run_id: Date.now().toString()
        }
      ]
    };

    return res.json(mockResponse);
  } catch (error) {
    console.error('Error in search:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;