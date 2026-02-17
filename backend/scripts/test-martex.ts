import { writeFileSync } from 'fs';
import { MartexProvider } from '../src/providers/martex';
import { closeBrowser } from '../src/providers/playwright';
import { parseHtml } from '../src/utils/parser';
import type { Supplier, SupplierCredential } from '../src/types';

async function run() {
  const provider = new MartexProvider();
  const supplier: Supplier = {
    id: 'martex-test',
    enabled: true,
    name: 'Martex',
    base_url: 'https://sklep.martextruck.pl',
    mode: 'render',
    search_url_template: 'https://sklep.martextruck.pl/partscatalogue/searchresult.aspx?search={query}',
    selectors: {
      result_selectors: {
        item: '.partscontrol-box',
        name: '.partscontrol-box-detail-link',
        price: '.partscontrol-box-articles-price-gross-cont',
        link: '.partscontrol-box-detail-link'
      }
    }
  };

  const credential: SupplierCredential = {
    id: 'martex',
    name: 'Martex',
    login: process.env.MARTEX_USER || 'EC01',
    password: process.env.MARTEX_PASS || 'martex1234',
    url: 'https://sklep.martextruck.pl/pages/login.aspx',
    notes: null,
    active: true
  };

  const query = process.argv[2] || '364624';
  const searchUrl = supplier.search_url_template.replace('{query}', encodeURIComponent(query));

  try {
    const result = await provider.loginAndFetch(supplier, credential, searchUrl, 30000);
    console.log('Fetch status:', result.status, result.error ? `(error: ${result.error.message})` : '');
    if (result.html) {
      const outPath = process.env.MARTEX_DUMP_PATH || 'martex-results-latest.html';
      writeFileSync(outPath, result.html, 'utf8');
      const items = parseHtml(result.html, supplier);
      console.log(`Parsed ${items.length} items. Showing first 3:`);
      console.log(items.slice(0, 3));
      const focusCode = process.env.MARTEX_FOCUS_CODE || 'WK731';
      const focusItem = items.find(item => item.code === focusCode);
      if (focusItem) {
        console.log(`Focus item (${focusCode}):`, focusItem);
      }
    }
  } catch (err) {
    console.error('Test run failed:', err);
  } finally {
    await closeBrowser();
  }
}

run();
