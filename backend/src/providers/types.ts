import { Supplier, SupplierCredential } from '../types';

export interface ProviderFetchResult {
  html: string;
  status: number;
  error?: Error;
}

export interface SupplierProvider {
  /** Return true if this provider supports the given supplier */
  supports(supplier: Supplier): boolean;
  /** Perform login (using credential) and navigate to searchUrl, then return HTML */
  loginAndFetch(
    supplier: Supplier,
    credential: SupplierCredential,
    searchUrl: string,
    timeoutMs?: number
  ): Promise<ProviderFetchResult>;
}

