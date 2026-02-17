import { MartexProvider } from '../src/providers/martex';
import { closeBrowser } from '../src/providers/playwright';
import { parseHtml } from '../src/utils/parser';
import type { Supplier, SupplierCredential } from '../src/types';

function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return 'N/A';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
}

function formatAvailability(availability: number | null): string {
  if (availability === null) return 'Unknown';
  if (availability <= 0) return 'Out of stock';
  return `${availability} in stock`;
}

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
        price: '.partscontrol-box-articles-price-net, .partscontrol-box-articles-price-gross',
        code: '.partscontrol-box-articles-articleid',
        availability: '.partscontrol-box-info',
        delivery: '.partscontrol-box-articles-order',
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
    if (!result.html) {
      console.error('Empty HTML returned from provider', result.error);
      return;
    }

    const items = parseHtml(result.html, supplier);

    const preview = items.slice(0, 10).map(item => ({
      store: item.store,
      product: item.name,
      code: item.code,
      price: item.price,
      price_display: formatPrice(item.price),
      availability: item.availability,
      availability_display: formatAvailability(item.availability),
      delivery: item.delivery
    }));

    console.table(preview);
  } finally {
    await closeBrowser();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
