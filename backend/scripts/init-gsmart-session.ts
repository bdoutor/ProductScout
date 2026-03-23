import 'dotenv/config';
import { supabase } from '../src/utils/supabase';
import { decryptPassword } from '../src/utils/secrets';
import { GsmartProvider } from '../src/providers/gsmart';
import { closeBrowser } from '../src/providers/playwright';
import { loadSessionCache } from '../src/utils/session-cache';

async function main() {
  process.env.PLAYWRIGHT_HEADLESS = 'false';

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('name', 'GSMART')
    .single();

  if (supplierError || !supplier) {
    throw new Error(`Failed to load GSMART supplier: ${supplierError?.message || 'not found'}`);
  }

  const { data: credential, error: credError } = await supabase
    .from('supplier_credentials')
    .select('*')
    .eq('name', 'GSMART')
    .eq('active', true)
    .single();

  if (credError || !credential) {
    throw new Error(`Failed to load GSMART credentials: ${credError?.message || 'not found'}`);
  }

  let password: string;
  try {
    password = decryptPassword(String(credential.password));
  } catch {
    password = process.env.GSMART_PASSWORD_FALLBACK || String(credential.password || '');
  }

  const provider = new GsmartProvider();
  const query = String(process.env.GSMART_INIT_QUERY || '364624').trim() || '364624';
  const searchUrl = String(supplier.search_url_template || '').replace('{query}', encodeURIComponent(query));
  const runtimeCred = { ...credential, password };
  const cacheKey = `gsmart-${supplier.id || supplier.name || 'default'}`;

  console.log('[GSMART] Session initialization started.');
  console.log('[GSMART] A browser window will open. Solve captcha if requested, then wait for completion.');

  const startedAt = Date.now();
  const result = await provider.loginAndFetch(supplier as any, runtimeCred as any, searchUrl, 45000);
  const elapsedMs = Date.now() - startedAt;

  if (result.error) {
    throw new Error(result.error.message || 'Unknown GSMART session initialization error');
  }

  const cachedCookies = loadSessionCache(cacheKey);
  if (!cachedCookies || cachedCookies.length === 0) {
    throw new Error('Session initialization finished but no cookies were cached.');
  }

  console.log(`[GSMART] Session initialized successfully in ${elapsedMs}ms.`);
  console.log(`[GSMART] Cached cookies: ${cachedCookies.length}`);
}

main()
  .catch((err) => {
    console.error('[GSMART] Session initialization failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser().catch(() => {});
  });
