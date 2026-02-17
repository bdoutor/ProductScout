// @ts-nocheck
import * as cheerio from 'cheerio';
import { ProductItem, Supplier } from '../types';

const MARTEX_DEFAULT_BASE_URL = 'https://sklep.martextruck.pl';

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

function ensureMartexBaseUrl(baseUrl?: string): string {
  if (baseUrl && /martextruck\.pl/i.test(baseUrl)) {
    return baseUrl.replace(/\/$/, '');
  }
  return MARTEX_DEFAULT_BASE_URL;
}

function collapseWhitespace(value: string | undefined | null): string {
  return (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDelivery(value: string | undefined | null): string | null {
  const collapsed = collapseWhitespace(value);
  if (!collapsed) return null;
  const sanitized = collapsed.replace(/\b(Go further|Go\s*further|Dalej|Add to Cart|Do koszyka)\b/gi, '').trim();
  return sanitized || null;
}

function matchFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return (match[1] || match[0] || '').trim();
    }
  }
  return null;
}

function parseQuantityToken(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = raw.match(/\d+/);
  if (!digits) return null;
  const parsed = parseInt(digits[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function sanitizeQuantityLabel(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\b(pcs|szt\.?|szt|pc)\b\.?/gi, '')
    .replace(/\s+/g, '')
    .trim();
  return cleaned || null;
}

function parseMartexQuantity(raw: string | undefined | null) {
  const label = sanitizeQuantityLabel(raw);
  const qty = parseQuantityToken(raw);
  const hasSymbol = typeof raw === 'string' && /[>+]/.test(raw);
  const hasStock = qty !== null ? qty > 0 : Boolean(label && hasSymbol);
  const isOut = qty !== null && qty === 0 && !hasSymbol;
  return {
    raw,
    label,
    qty,
    hasStock,
    isOut,
  };
}

function extractQuantityFromClass(classAttr: string | undefined | null): number | null {
  if (!classAttr) return null;
  const explicit = classAttr.match(/quantity_(\d+)/);
  if (explicit) {
    const parsed = parseInt(explicit[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (classAttr.includes('quantity_zero')) return 0;
  if (classAttr.includes('quantity_above')) return 6;
  if (classAttr.includes('quantity_available')) return 1;
  return null;
}

function extractMartexAvailability(text: string, classAttr: string | undefined | null): { availability: number | null; summary: string | null } {
  const summaryParts: string[] = [];
  const centralRaw = matchFirst(text, [
    /(?:central(?: warehouse)?|centrala)\s*[:\-]?\s*([>\d\s]+(?:pcs|szt\.?)?)/i,
  ]);
  if (centralRaw) summaryParts.push(`Central: ${centralRaw}`);

  const branchRaw = matchFirst(text, [
    /(?:branches|oddzia[a-zł]+)\s*[:\-]?\s*([>\d\s]+(?:pcs|szt\.?)?)/i,
  ]);
  if (branchRaw) summaryParts.push(`Branches: ${branchRaw}`);

  const totalRaw = matchFirst(text, [
    /(?:available|dost(?:e|ę)pne)\s*[:\-]?\s*([>\d\s]+(?:pcs|szt\.?)?)/i,
  ]);

  const centralQty = parseQuantityToken(centralRaw);
  const branchQty = parseQuantityToken(branchRaw);
  let availability: number | null = null;

  if (centralQty !== null || branchQty !== null) {
    availability = (centralQty ?? 0) + (branchQty ?? 0);
  } else {
    availability = parseQuantityToken(totalRaw);
  }

  if (availability === null) {
    availability = extractQuantityFromClass(classAttr);
  }

  const summary = summaryParts.length ? summaryParts.join(' | ') : null;
  return { availability, summary };
}

function extractMartexDetails($el: any) {
  const priceCandidates = [
    collapseWhitespace($el.find('.partscontrol-box-articles-price-net').first().text()),
    collapseWhitespace($el.find('.partscontrol-box-articles-price-gross').first().text()),
    collapseWhitespace($el.find('.partscontrol-box-articles-price-value').first().text()),
  ];
  const priceStr = priceCandidates.find(Boolean);
  const availabilityText = collapseWhitespace($el.find('.partscontrol-box-info').text());
  const availabilityClass = $el.attr('class');
  const availabilityParsed = extractMartexAvailability(availabilityText || '', availabilityClass);
  let availabilityLabel: string | null = null;
  if (availabilityParsed.availability !== null) {
    const qty = availabilityParsed.availability;
    if (qty === 0) {
      availabilityLabel = '0';
    } else if (qty >= 5) {
      availabilityLabel = '>5 in stock';
    } else {
      availabilityLabel = `${qty} in stock`;
    }
  } else if (availabilityParsed.summary) {
    availabilityLabel = availabilityParsed.summary;
  } else if (availabilityText) {
    availabilityLabel = availabilityText;
  }
  return {
    price: parsePrice(priceStr || ''),
    availability: availabilityParsed.availability,
    availabilityLabel,
    summary: availabilityParsed.summary,
  };
}

function getSupplierSpecificSelectors(supplier: Supplier): any {
  if (supplier.name.toLowerCase().includes('nipocar')) {
    return {
      // Nipocar catalogue search results
      item: '.product-list-item, .product-list > .row, .product-list > div, .product-item, .row.produto, .produto, .product-wrapper, .lista-produtos .row, .lista-produtos li, .product-row, .linha-produto, .listagem-produtos .row, table.table tbody tr, table tbody tr',
      name: '.product-name, h3 a, h3, .title, .nome, .descricao, td:nth-child(2)',
      code: '.product-code, .ref, .sku, .referencia, .product-name a, td:nth-child(1)',
      price: '.price, .product-price, .preco, .price-value, .preco-value, td:nth-child(4)',
      availability: '.availability, .stock, .disponibilidade, .badge-stock, .porto, .lisboa, td:nth-child(5)',
      delivery: '.delivery, .prazo, .lead-time',
      link: '.product-name a, h3 a, a[href*="produto"], a[href*="product"], a[href*="id"], a'
    };
  }
  if (supplier.name.toLowerCase().includes('casals')) {
    return {
      item: 'table.table tbody tr',
      name: 'td:nth-child(2)',
      code: 'td:nth-child(1)',
      price: 'td:nth-child(4)',
      link: 'td:nth-child(6) a',
      availability: 'td:nth-child(1)'
    };
  }
  // Seletores específicos para o Auger
  if (supplier.name.toLowerCase().includes('auger')) {
    return {
      item: '.product-card, .search-result-item',
      name: '.card-title',
      code: '.card-text .fc-red, .card-text, .product-code, .product-number',
      price: '.price, .result-price, .product-price',
      availability: '.product-stock-info__count, .stock-status, td.availability, .stock-info',
      delivery: '.delivery-info, td.delivery, .delivery-estimate',
      link: '.card-title a, a[href*="product-detail"], a.product-link, .item-link'
    };
  }
  if (supplier.name.toLowerCase().includes('martex')) {
    return {
      item: '.partscontrol-box',
      name: '.partscontrol-box-detail-link',
      code: '.partscontrol-box-articles-articleid',
      price: '.partscontrol-box-articles-price-net, .partscontrol-box-articles-price-gross',
      availability: '.partscontrol-box-info',
      delivery: '.partscontrol-box-articles-order',
      link: '.partscontrol-box-detail-link'
    };
  }
  return supplier.selectors.result_selectors;
}

export function parseHtml(
  html: string,
  supplier: Supplier
): ProductItem[] {
  const $ = cheerio.load(html);
  let items: ProductItem[] = [];
  const selectors = getSupplierSpecificSelectors(supplier);
  const isMartex = supplier.name.toLowerCase().includes('martex');
  const isCasals = supplier.name.toLowerCase().includes('casals');
  const isNipocar = supplier.name.toLowerCase().includes('nipocar');
  const martexBaseUrl = isMartex ? ensureMartexBaseUrl(supplier.base_url) : supplier.base_url;

  $(selectors.item).each((_, element) => {
    const $el = $(element);

    let nameText = selectors.name
      ? (selectors.name === 'self' ? $el.text().trim() : $el.find(selectors.name).text().trim())
      : '';
    if (!nameText) {
      nameText = $el.attr('data-name') || '';
    }
    if (!nameText) {
      nameText = $el.find('a[href*="product-detail"]').first().text().trim();
    }

    const titleEl = $el.find('.card-title').first();
    const titleLink = titleEl.find('a').first();
    if (titleEl.length) {
      const baseSource = titleLink.length ? titleLink : titleEl;
      const baseTitle = baseSource.clone().children().remove().end().text().trim();
      const additionalTitle = (titleLink.length ? titleLink : titleEl).find('span').text().trim();
      if (supplier.name.toLowerCase().includes('auger')) {
        if (baseTitle) {
          nameText = baseTitle;
        }
      } else {
        const combined = [baseTitle, additionalTitle].filter(Boolean).join(' ').trim();
        if (combined) {
          nameText = combined;
        }
      }
    }
    nameText = nameText.replace(/\s+/g, ' ').trim();

    let codeText = selectors.code ? $el.find(selectors.code).first().text().trim() : null;
    if (codeText && codeText.length === 0) codeText = null;
    if (codeText) {
      codeText = codeText.replace(/\s+/g, '').trim();
    }
    if (!codeText) {
      const maybeCode = $el.attr('data-sku')
        || $el.find('.card-result-count, .product-results__shortlist li').first().text().trim();
      codeText = maybeCode ? maybeCode : null;
    }

    const priceText = selectors.price ? $el.find(selectors.price).first().text().trim() : '';
    let availText = selectors.availability ? $el.find(selectors.availability).first().text().trim() : null;
    if (availText && availText.length === 0) availText = null;

    const deliveryText = selectors.delivery ? normalizeDelivery($el.find(selectors.delivery).first().text()) : null;
    const linkHref = selectors.link
      ? (selectors.link === 'self' ? $el.attr('href') : $el.find(selectors.link).attr('href'))
      : '';
    const fallbackBase = martexBaseUrl || supplier.base_url || (isMartex ? MARTEX_DEFAULT_BASE_URL : '');
    const absoluteUrl = fallbackBase ? extractAbsoluteUrl(linkHref, fallbackBase) : (linkHref || '');

    if (!nameText) return; // Skip items without a name

    const item: ProductItem = {
      name: nameText,
      code: codeText || null,
      price: parsePrice(priceText),
      availability: parseAvailability(availText),
      delivery: deliveryText,
      url: absoluteUrl,
      store: supplier.name
    };

    if (isCasals) {
      const codeCell = selectors.availability ? $el.find(selectors.availability).first() : $el.find(selectors.code).first();
      const cls = (codeCell.attr('class') || '').toLowerCase();
      const isGreen = cls.includes('green');
      const isRed = cls.includes('red');
      if (isGreen) {
        item.availability = 1;
        (item as any).availability_label = 'In stock';
      } else if (isRed) {
        item.availability = 0;
        (item as any).availability_label = 'Out of stock';
      }
    }

    if (isNipocar) {
      // If availability text mentions disponibilidade/porto/lisboa, assume in stock; otherwise keep parsed value.
      const availRaw = availText ? availText.toLowerCase() : '';
      if (item.availability === null) {
        if (/dispon/i.test(availRaw) || /porto/.test(availRaw) || /lisboa/.test(availRaw)) {
          item.availability = 1;
          (item as any).availability_label = (item as any).availability_label || 'In stock';
        }
      }
    }

    if (isMartex) {
      const martexDetails = extractMartexDetails($el);
      if (martexDetails.price !== null) {
        item.price = martexDetails.price;
      }
      if (martexDetails.availability !== null) {
        item.availability = martexDetails.availability;
      }
      if (martexDetails.availabilityLabel) {
        (item as any).availability_label = martexDetails.availabilityLabel;
      }
      if (martexDetails.summary) {
        (item as any).stock_summary = martexDetails.summary;
      }
      if (item.delivery && typeof item.delivery === 'string' && item.delivery.toLowerCase().includes('central')) {
        item.delivery = null;
      }
    }

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
      } as ProductItem);
    });
  }

  const uniqueItems: ProductItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = `${item.url}|${item.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

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

