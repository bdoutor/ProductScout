import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { AirFrenProvider } from '../src/providers/airfren';
import { closeBrowser } from '../src/providers/playwright';

const SUPPLIER = {
  id: '5e76cd57-4e0d-47ac-8bd3-b81a86ae1ed5',
  name: 'Air Fren',
  base_url: 'https://airfren.com',
  login_url: 'https://airfren.com/login',
  mode: 'render',
  supplier_key: 'airfren',
  auth_mode: 'auto',
} as any;

const CREDENTIAL = {
  id: 'a325d35c-7e42-4fdc-b36f-a0a019ed70e3',
  name: 'AIR FREN',
  login: 'eurocomponentes@eurocomponentes.pt',
  password: '20201999',
  url: 'https://airfren.com/login',
  active: true,
} as any;

const SEARCH_URL = 'https://airfren.com/catalogo-productos?search=reference&q=filtro';

async function main() {
  const provider = new AirFrenProvider();
  console.log('\n[AirFrenProvider] Starting loginAndFetch...');
  const result = await provider.loginAndFetch(SUPPLIER, CREDENTIAL, SEARCH_URL, 45000);

  if (result.error) {
    console.error('\n[ERROR]', result.error.message);
    process.exitCode = 1;
  } else {
    console.log('\n[OK] status:', result.status, '— HTML length:', result.html.length);
    const nologin = (result.html.match(/nologin/g) || []).length;
    const cards = (result.html.match(/product-card/g) || []).length;
    const disponible = (result.html.match(/Disponible/g) || []).length;
    console.log('  product-card:', cards, '| nologin:', nologin, '| Disponible:', disponible);
    fs.writeFileSync(path.resolve(process.cwd(), 'tmp-airfren-provider-result.html'), result.html, 'utf8');
    console.log('  [saved] tmp-airfren-provider-result.html');
  }
  await closeBrowser().catch(() => {});
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
