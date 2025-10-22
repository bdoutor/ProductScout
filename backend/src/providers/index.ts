import { Supplier } from '../types';
import { SupplierProvider } from './types';
import { AugerProvider } from './auger';

const providers: SupplierProvider[] = [
  new AugerProvider(),
];

export function getProviderForSupplier(supplier: Supplier): SupplierProvider | null {
  for (const p of providers) {
    try {
      if (p.supports(supplier)) return p;
    } catch {}
  }
  return null;
}

