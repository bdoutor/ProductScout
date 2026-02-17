export interface Supplier {
  id: string;
  enabled: boolean;
  name: string;
  base_url: string;
  mode: 'http' | 'render';
  search_url_template: string;
  // Optional auth/login fields for transitional support
  login_url?: string | null;
  url?: string | null; // some schemas use 'url' for login page
  login?: string | null;
  password?: string | null;
  login_selector?: string | null;
  password_selector?: string | null;
  submit_selector?: string | null;
  selectors: {
    result_selectors: {
      item: string;
      name: string;
      code?: string;
      price: string;
      availability?: string;
      delivery?: string;
      link: string;
    };
  };
  timeouts?: {
    search?: number;
    extract?: number;
  };
}

export interface SearchRun {
  id?: string;
  created_at?: string;
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

export interface SearchResponse {
  query: string;
  items: ProductItem[];
  per_supplier: SupplierResult[];
  message?: string;
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

export interface TestSupplierResponse {
  search_run: SearchRun;
  items: ProductItem[];
}

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  BLOCKED_BY_ROBOT = 'BLOCKED_BY_ROBOT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Minimal shape for supplier credentials stored in DB
export interface SupplierCredential {
  id: string;
  name: string; // should match supplier.name
  login: string;
  password?: string; // encrypted at rest; decrypted only at runtime
  url: string; // login URL
  notes?: string | null;
  active: boolean;
}
