import { Router, Request, Response } from 'express';
import { SearchResponse } from '../types';

const router = Router();

router.post('/test-search', async (req: Request, res: Response) => {
  const { query, debug = false } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Generate mock response with the actual query
    const mockResponse: SearchResponse = {
      query,
      items: [
        {
          name: `AUGER Part ${query} - Original`,
          code: query,
          price: 199.99,
          availability: 5,
          delivery: '2-3 business days',
          url: `https://auger-shop.com/product/${query}`,
          store: 'AUGER Shop'
        },
        {
          name: `Alternative ${query} - Compatible`,
          code: `ALT-${query}`,
          price: 149.99,
          availability: 3,
          delivery: '1-2 business days',
          url: `https://auger-shop.com/product/alt-${query}`,
          store: 'AUGER Shop'
        }
      ],
      per_supplier: [
        {
          supplier_name: 'AUGER',
          status: 'success',
          items_found: 2,
          search_run_id: Date.now().toString()
        }
      ]
    };

    // Log the response for debugging
    console.log('Sending mock response:', JSON.stringify(mockResponse, null, 2));
    
    return res.json(mockResponse);
  } catch (error) {
    console.error('Error in test-search:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;