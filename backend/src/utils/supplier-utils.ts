import { Supplier } from '../types';

/**
 * Returns the stable machine key for a supplier.
 *
 * Priority:
 *   1. supplier.supplier_key from Supabase  (set once via SQL migration)
 *   2. Derived from supplier.name / base_url (backward compat until migration runs)
 *
 * All supplier-specific branching in the codebase should use this function
 * instead of supplier.name.toLowerCase().includes('xxx').
 * That way renaming a supplier in Supabase never breaks behaviour.
 */
export function getSupplierKey(supplier: Supplier): string {
  if (supplier.supplier_key) return supplier.supplier_key.toLowerCase().trim();

  // Fallback derivation — only active before the DB migration is applied
  const name = (supplier.name || '').toLowerCase();
  const base = (supplier.base_url || '').toLowerCase();
  if (name.includes('auger')) return 'auger';
  if (name.includes('gsmart') || base.includes('gsmart.eu')) return 'gsmart';
  if (name.includes('nipocar') || base.includes('nipocar.pt')) return 'nipocar';
  if (name.includes('martex')) return 'martex';
  if (name.includes('casals')) return 'casals';
  if (name.includes('evoparts')) return 'evoparts';
  return name;
}

export function getSupplierSessionCacheKey(supplier: Supplier): string {
  const key = getSupplierKey(supplier);
  const suffix = String(supplier.id || supplier.name || 'default');
  return `${key}-${suffix}`;
}
