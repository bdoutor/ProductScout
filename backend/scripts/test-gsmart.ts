import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { supabase } from '../src/utils/supabase';
import { decryptPassword } from '../src/utils/secrets';
import { GsmartProvider } from '../src/providers/gsmart';
import { closeBrowser } from '../src/providers/playwright';

async function main() {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('name', 'GSMART')
      .single();

    if (supplierError || !supplier) {
      throw new Error(`Failed to load supplier: ${supplierError?.message || 'not found'}`);
    }

    const { data: credential, error: credError } = await supabase
      .from('supplier_credentials')
      .select('*')
      .eq('name', 'GSMART')
      .single();

    if (credError || !credential) {
      throw new Error(`Failed to load credentials: ${credError?.message || 'not found'}`);
    }

    let password: string;
    try {
      password = decryptPassword(String(credential.password));
    } catch {
      password = process.env.GSMART_PASSWORD_FALLBACK || 'Euro1999';
    }

    const decrypted = {
      ...credential,
      password
    };

    const provider = new GsmartProvider();
    const query = '364624';
    const searchUrl = supplier.search_url_template.replace('{query}', encodeURIComponent(query));
    const result = await provider.loginAndFetch(supplier as any, decrypted as any, searchUrl, 30000);

    const outPath = path.resolve(__dirname, '..', 'gsmart-provider-dump.html');
    fs.writeFileSync(outPath, result.html || '');
    console.log(`HTML dumped to ${outPath}, status=${result.status}, error=${result.error?.message || 'none'}`);
  } finally {
    await closeBrowser().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
