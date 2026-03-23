import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { RymeProvider } from '../src/providers/ryme';
import { closeBrowser } from '../src/providers/playwright';

const SUPPLIER = {
  id: 'f55d22e8-ed81-495c-ab15-e629759f8646',
  name: 'Ryme Automotive',
  base_url: 'https://b2b.rymeautomotive.com/pt',
  login_url: 'https://b2b.rymeautomotive.com/pt/login',
  mode: 'render',
  supplier_key: 'ryme',
  auth_mode: 'auto',
} as any;

const CREDENTIAL = {
  id: 'cred-ryme',
  supplier_id: SUPPLIER.id,
  login: '77141-00',
  password: 'AuTz93',
  url: 'https://b2b.rymeautomotive.com/pt/login',
  active: true,
} as any;

const SEARCH_URL = 'https://b2b.rymeautomotive.com/pt?q=filtro';

async function main() {
  const provider = new RymeProvider();
  console.log('\n[RymeProvider] Starting loginAndFetch...');
  console.log('  searchUrl:', SEARCH_URL);

  const result = await provider.loginAndFetch(SUPPLIER, CREDENTIAL, SEARCH_URL, 45000);

  if (result.error) {
    console.error('\n[ERROR]', result.error.message);
    process.exitCode = 1;
  } else {
    console.log('\n[OK] status:', result.status, '— HTML length:', result.html.length);
    const p = path.resolve(process.cwd(), 'tmp-ryme-provider-result.html');
    fs.writeFileSync(p, result.html, 'utf8');
    console.log('  [saved]', p);
  }

  await closeBrowser().catch(() => {});
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
