import axios from 'axios';
import {
  SearchResponse,
  SearchRun,
  ProgressiveSearchStartResponse,
  ProgressiveSearchProgressResponse
} from '@/types';

const API_URL =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const searchProducts = async (query: string, debug: boolean = false): Promise<SearchResponse> => {
  try {
    console.log('Making API request for query:', query);
    const response = await apiClient.post('/api/search', { query, debug });
    console.log('Raw API response from /api/search:', response.data);

    console.log('Using data from endpoint response:', response.data);

    if (!response.data) {
      throw new Error('No data received from API');
    }

    const rawData = response.data || {};
    rawData.items = rawData.items || [];
    rawData.per_supplier = rawData.per_supplier || [];

    const transformed: SearchResponse = {
      query,
      items: rawData.items.map((item: any) => {
        const nameRaw = item.name ?? item.title ?? '';
        const codeRaw = item.code ?? item.partNumber ?? null;
        let priceNum: number | null = null;
        if (typeof item.price === 'number' && !isNaN(item.price)) priceNum = item.price;
        else if (typeof item.price === 'string') {
          const parsed = Number(String(item.price).replace(/[^0-9.,-]/g, '').replace(',', '.'));
          priceNum = isNaN(parsed) ? null : parsed;
        }
        let availabilityNum: number | null = null;
        if (typeof item.availability === 'number' && !isNaN(item.availability)) availabilityNum = item.availability;
        else if (typeof item.availability === 'string') {
          const m = String(item.availability).match(/-?\d+/);
          availabilityNum = m ? Number(m[0]) : null;
        }
        return {
          name: String(nameRaw).trim(),
          code: codeRaw ? String(codeRaw).trim() : null,
          price: priceNum,
          availability: availabilityNum,
          delivery: item.delivery ? String(item.delivery).trim() : null,
          url: item.url ? String(item.url).trim() : '',
          store: (item.store ?? item.supplier ?? 'Unknown') as string,
          availability_label: item.availability_label ? String(item.availability_label).trim() : null,
          stock_summary: item.stock_summary ? String(item.stock_summary).trim() : null,
        };
      }),
      per_supplier: rawData.per_supplier.map((supplier: any) => ({
        supplier_name: String(supplier.supplier_name || supplier.name || '').trim(),
        supplier_id: supplier.supplier_id,
        status: supplier.error ? 'error' : (supplier.status || 'success'),
        items_found: supplier.items_found ?? supplier.items ?? 0,
        search_run_id: supplier.search_run_id,
        error_message: supplier.error || supplier.error_message || undefined,
        error_details: supplier.error_details || undefined,
      }))
    };

    console.log('Transformed response:', transformed);
    return transformed;
  } catch (error) {
    console.error('Error in searchProducts:', error);
    throw error;
  }
};

export const startProgressiveSearch = async (
  query: string,
  debug: boolean = false
): Promise<ProgressiveSearchStartResponse> => {
  try {
    const response = await apiClient.post('/api/search/progressive', { query, debug });
    const data = response.data || {};
    if (data.fallback) {
      data.fallback.items = data.fallback.items || [];
      data.fallback.per_supplier = data.fallback.per_supplier || [];
    }
    return data;
  } catch (error: any) {
    const backendMessage =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      'Failed to start progressive search';
    throw new Error(backendMessage);
  }
};

export const getProgressiveSearchProgress = async (
  runId: string
): Promise<ProgressiveSearchProgressResponse> => {
  const response = await apiClient.get(`/api/search/progressive/${runId}`);
  const data = response.data || {};
  data.items = data.items || [];
  data.per_supplier = data.per_supplier || [];
  return data as ProgressiveSearchProgressResponse;
};

export const testSupplier = async (
  supplier_id: string,
  query: string,
  debug: boolean = true
): Promise<{ search_run: SearchRun; items: any[] }> => {
  const response = await apiClient.post('/api/test-supplier', {
    supplier_id,
    query,
    debug,
  });
  return response.data;
};

export const getSearchRun = async (id: string): Promise<SearchRun> => {
  const response = await apiClient.get(`/api/search-runs/${id}`);
  return response.data;
};

export const getSuppliers = async (): Promise<any[]> => {
  const response = await apiClient.get('/api/suppliers');
  return response.data;
};

export default apiClient;
