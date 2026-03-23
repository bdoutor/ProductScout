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
  started_at?: string;
  finished_at?: string;
  elapsed_ms?: number;
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

export interface ManualSessionInitResponse {
  ok: boolean;
  supplier_name: string;
  job_id?: string;
  status?: 'queued' | 'running' | 'success' | 'error';
  message?: string;
  cache_key?: string;
  cached_cookies?: number;
  elapsed_ms?: number;
}

export interface SupplierAuthStatus {
  supplier_id: string;
  supplier_name: string;
  state: 'READY' | 'CHECKING' | 'MANUAL_REQUIRED' | 'ERROR' | 'DISABLED';
  reason_code?: string | null;
  reason_text?: string | null;
  manual_supported: boolean;
  last_check_at?: string | null;
  next_refresh_at?: string | null;
}

export interface SupplierAuthStatusResponse {
  items: SupplierAuthStatus[];
  updated_at?: string;
}

export interface ManualSessionJob {
  job_id: string;
  supplier_name: string;
  status: 'queued' | 'running' | 'success' | 'error';
  message?: string;
  error?: string;
  started_at: string;
  updated_at: string;
  finished_at?: string | null;
}

export interface SearchResponse {
  query: string;
  items: ProductItem[];
  per_supplier: SupplierResult[];
  message?: string;
  summary?: SearchResponseSummary;
}

export interface SearchResponseSummary {
  total_items: number;
  available_items: number;
  unavailable_items: number;
  unknown_availability_items: number;
  suppliers_total: number;
  suppliers_success: number;
  suppliers_error: number;
  suppliers_pending: number;
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
