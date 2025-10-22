import * as cheerio from 'cheerio';
import { ProductItem, Supplier } from '../types';

/**
 * Parse price string to number (handles EU and US formats)
 */
export function parsePrice(priceStr: string | undefined | null): number | null {
  if (!priceStr) return null;

  // Remove currency symbols and any non-numeric characters (keep digits, dots, commas, minus)
  let cleaned = priceStr.replace(/[^0-9.,-]/g, '').trim();

  // Determine decimal separator by the last occurrence
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot) {
    // EU style: 1.234,56 -> 1234.56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US style or no decimals: 1,234.56 -> 1234.56
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse availability to number (e.g., "Em stock (3)" -> 3, "Stock: 0" -> 0)
 */
export function parseAvailability(availStr: string | undefined | null): number | null {
  if (!availStr) return null;

  // Look for explicit quantity
  const match = availStr.match(/\d+/);
  if (match) return parseInt(match[0], 10);

  const lowerStr = availStr.toLowerCase();

  // Positive signals (pt/en)
  if (
    lowerStr.includes('em stock') ||
    lowerStr.includes('disponivel') ||
    lowerStr.includes('disponível') ||
    lowerStr.includes('available') ||
    lowerStr.includes('in stock')
  ) {
    return 1;
  }

  // Negative signals (pt/en)
  if (
    lowerStr.includes('esgotado') ||
    lowerStr.includes('sem stock') ||
    lowerStr.includes('indisponivel') ||
    lowerStr.includes('indisponível') ||
    lowerStr.includes('out of stock') ||
    lowerStr.includes('unavailable')
  ) {
    return 0;
  }

  return null;
}

/**
 * Extract absolute URL from href
 */
export function extractAbsoluteUrl(href: string | undefined, baseUrl: string): string {
  if (!href) return '';

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  if (href.startsWith('//')) {
    return 'https:' + href;
  }

  if (href.startsWith('/')) {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}${href}`;
  }

  return new URL(href, baseUrl).href;
}

/**
 * Parse HTML using supplier selectors
 */
function getSupplierSpecificSelectors(supplier: Supplier) {
  // Seletores específicos para o Auger
  if (supplier.name.toLowerCase().includes('auger')) {
    return {
      item: '.product-item, tr.product, .search-result-item',
      name: '.product-name, td.description, .item-description',
      code: '.product-code, td.reference, .item-reference',
      price: '.product-price, td.price, .item-price',
      availability: '.stock-status, td.availability, .stock-info',
      delivery: '.delivery-info, td.delivery, .delivery-estimate',
      link: 'a.product-link, td.description a, .item-link'
    };
  }
  return supplier.selectors.result_selectors;
}

export function parseHtml(
  html: string,
  supplier: Supplier
): ProductItem[] {
  const $ = cheerio.load(html);
  const items: ProductItem[] = [];
  const selectors = getSupplierSpecificSelectors(supplier);

  $(selectors.item).each((_, element) => {
    const $el = $(element);

    const nameText = selectors.name
      ? (selectors.name === 'self' ? $el.text().trim() : $el.find(selectors.name).text().trim())
      : '';
    const codeText = selectors.code ? $el.find(selectors.code).text().trim() : null;
    const priceText = selectors.price ? $el.find(selectors.price).text().trim() : '';
    const availText = selectors.availability ? $el.find(selectors.availability).text().trim() : null;
    const deliveryText = selectors.delivery ? $el.find(selectors.delivery).text().trim() : null;
    const linkHref = selectors.link
      ? (selectors.link === 'self' ? $el.attr('href') : $el.find(selectors.link).attr('href'))
      : '';

    if (!nameText) return; // Skip items without a name

    const item: ProductItem = {
      name: nameText,
      code: codeText || null,
      price: parsePrice(priceText),
      availability: parseAvailability(availText),
      delivery: deliveryText || null,
      url: extractAbsoluteUrl(linkHref, supplier.base_url),
      store: supplier.name
    };

    items.push(item);
  });
  // Heuristic fallback for Auger: anchors linking to product-detail
  if (items.length === 0 && supplier.name.toLowerCase().includes('auger')) {
    $('a[href*="product-detail"]').each((_, el) => {
      const $a = $(el);
      const nameText = $a.text().trim();
      if (!nameText) return;
      const href = $a.attr('href');
      items.push({
        name: nameText,
        code: null,
        price: null,
        availability: null,
        delivery: null,
        url: extractAbsoluteUrl(href, supplier.base_url),
        store: supplier.name,
      });
    });
  }

  return items;
}

/**
 * Sort items: available first (by price ASC), then unavailable
 */
export function sortItems(items: ProductItem[]): ProductItem[] {
  return items.sort((a, b) => {
    const A = (a.availability ?? 0) > 0 ? 0 : 1;
    const B = (b.availability ?? 0) > 0 ? 0 : 1;

    if (A !== B) return A - B;

    const ap = a.price ?? Number.POSITIVE_INFINITY;
    const bp = b.price ?? Number.POSITIVE_INFINITY;

    return ap - bp;
  });
}

/**
 * Detect if page contains robot/captcha blocking
 */
export function isBlockedByRobot(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  const blockIndicators = [
    'captcha',
    'robot',
    'access denied',
    'forbidden',
    'cloudflare',
    'are you a robot',
    'verify you are human'
  ];

  return blockIndicators.some(indicator => lowerHtml.includes(indicator));
}
