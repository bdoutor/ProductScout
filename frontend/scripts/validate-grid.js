const fs = require('fs');
const path = require('path');
const parserPath = path.resolve(__dirname, '../../backend/dist/utils/parser.js');
if (!fs.existsSync(parserPath)) {
  console.error(`Parser bundle not found at ${parserPath}. Run "npm run build" in backend first.`);
  process.exit(1);
}
console.log('Loading parser from:', parserPath);
const parseHtml = require(parserPath).parseHtml;

function transformForGrid(items) {
  return items.map((item) => {
    const nameRaw = item.name ?? '';
    const codeRaw = item.code ?? null;

    let priceNum = null;
    if (typeof item.price === 'number' && !Number.isNaN(item.price)) {
      priceNum = item.price;
    } else if (typeof item.price === 'string') {
      const normalized = item.price.trim();
      if (/^[\d\s.,-]+(?:€|eur|pln|zł)?$/i.test(normalized)) {
        const parsed = Number(normalized.replace(/[^0-9.,-]/g, '').replace(',', '.'));
        priceNum = Number.isNaN(parsed) ? null : parsed;
      }
    }

    let availabilityNum = null;
    if (typeof item.availability === 'number' && !Number.isNaN(item.availability)) {
      availabilityNum = item.availability;
    } else if (typeof item.availability === 'string') {
      const normalizedAvailability = item.availability.trim();
      if (!/central|branches/i.test(normalizedAvailability)) {
        const match = normalizedAvailability.match(/-?\d+/);
        availabilityNum = match ? Number(match[0]) : null;
      }
    }

    return {
      name: String(nameRaw).trim(),
      code: codeRaw ? String(codeRaw).trim() : null,
      price: priceNum,
      availability: availabilityNum,
      delivery: item.delivery ? String(item.delivery).trim() : null,
      url: item.url ? String(item.url).trim() : '',
      store: item.store ?? 'Unknown',
    };
  });
}

function formatPrice(value) {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatAvailability(value) {
  if (value === null) return 'Unknown';
  if (value <= 0) return 'Out of stock';
  return `${value} in stock`;
}

function run() {
  const htmlPath = path.resolve(__dirname, '../../backend/martex-results-latest.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`HTML source not found at ${htmlPath}. Run backend/scripts/test-martex.ts first.`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const supplier = {
    id: 'martex-test',
    enabled: true,
    name: 'Martex',
    base_url: 'https://sklep.martextruck.pl',
    mode: 'render',
    search_url_template: '',
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

  const parsedItems = parseHtml(html, supplier);
  const gridItems = transformForGrid(parsedItems);

  console.log('Parsed items count:', parsedItems.length);
  console.log('Grid items preview (first 10):');
  console.table(
    gridItems.slice(0, 10).map(item => ({
      store: item.store,
      product: item.name,
      code: item.code,
      price: item.price,
      price_display: formatPrice(item.price),
      availability: item.availability,
      availability_display: formatAvailability(item.availability),
      delivery: item.delivery
    }))
  );
}

run();
