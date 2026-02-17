export interface ProductItem {
  name: string;
  code: string | null;
  price: number | null;
  availability: number | null;
  delivery: string | null;
  url: string;
  store: string;
  availability_label?: string | null;
  stock_summary?: string | null;
}

export interface SupplierResult {
  supplier_name: string;
  status: 'success' | 'error' | 'pending';
  items_found: number;
  search_run_id?: string;
  supplier_id?: string;
  error_message?: string;
  error_details?: string;
}

export interface ProgressiveSearchStartResponse {
  run_id?: string;
  total_suppliers?: number;
  poll_interval_ms?: number;
  fallback?: SearchResponse;
}

export interface ProgressiveSearchProgressResponse extends SearchResponse {
  run_id: string;
  total_suppliers: number;
  completed_suppliers: number;
  done: boolean;
  error?: string;
  last_update?: string;
}

export interface SearchResponse {
  query: string;
  items: ProductItem[];
  per_supplier: SupplierResult[];
  message?: string;
}

export interface SearchRun {
  id: string;
  created_at: string;
  reference: string;
  supplier_id: string;
  status: 'running' | 'success' | 'error';
  step_failed?: 'search' | 'extract' | null;
  error_message?: string | null;
  error_details?: string | null;
  engine: 'http' | 'render';
  search_url_effective: string;
  http_status_search?: number | null;
  durations?: {
    search_ms?: number;
    extract_ms?: number;
    total_ms?: number;
  };
  selector_counts?: {
    items?: number;
  };
  debug_snapshot_url?: string | null;
}
