import axios from 'axios';
import { SearchResponse, SearchRun } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const searchProducts = async (query: string, debug: boolean = false): Promise<SearchResponse> => {
  const response = await apiClient.post('/api/search', { query, debug });
  return response.data;
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
