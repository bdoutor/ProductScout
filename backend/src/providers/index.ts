import { Supplier } from '../types';
import { SupplierProvider } from './types';
import { AugerProvider } from './auger';
import { MartexProvider } from './martex';
import { GsmartProvider } from './gsmart';
import { CasalsProvider } from './casals';
import { NipocarProvider } from './nipocar';
import { EvoPartsProvider } from './evoparts';
import { RymeProvider } from './ryme';
import { AirFrenProvider } from './airfren';

const providers: SupplierProvider[] = [
  new AugerProvider(),
  new MartexProvider(),
  new GsmartProvider(),
  new CasalsProvider(),
  new NipocarProvider(),
  new EvoPartsProvider(),
  new RymeProvider(),
  new AirFrenProvider(),
];

export function getProviderForSupplier(supplier: Supplier): SupplierProvider | null {
  for (const p of providers) {
    try {
      if (p.supports(supplier)) return p;
    } catch {}
  }
  return null;
}
