import * as cheerio from 'cheerio';
import { ProductItem, Supplier } from '../types';
import { getSupplierKey } from './supplier-utils';

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

  const normalized = availStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Negative signals first to avoid false positives like "nao disponivel".
  if (
    normalized.includes('esgotado') ||
    normalized.includes('sem stock') ||
    normalized.includes('indisponivel') ||
    normalized.includes('nao disponivel') ||
    normalized.includes('out of stock') ||
    normalized.includes('unavailable')
  ) {
    return 0;
  }

  // Look for explicit quantity after negative checks.
  const match = normalized.match(/\d+/);
  if (match) return parseInt(match[0], 10);

  // Positive signals (pt/en)
  if (
    normalized.includes('em stock') ||
    normalized.includes('disponivel') ||
    normalized.includes('available') ||
    normalized.includes('in stock')
  ) {
    return 1;
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

function extractEvoPartsCode(raw: string | undefined | null): string | null {
  const text = collapseWhitespace(raw);
  if (!text) return null;
  const artMatch = text.match(/\bart\.?\s*:\s*([A-Za-z0-9._/-]+)/i);
  if (artMatch && artMatch[1]) return artMatch[1].trim();
  const refMatch = text.match(/\bref\.?\s*:\s*([A-Za-z0-9._/-]+)/i);
  if (refMatch && refMatch[1]) return refMatch[1].trim();
  return null;
}

function parseEvoPartsAvailability(
  $el: any,
  availText: string | null
): { availability: number | null; label: string | null } {
  const rawTextBlock = collapseWhitespace(
    [
      availText || '',
      $el.find('.stockgroup, .stock, .availability, .c_product_quantity, .c_product_grid_details').text(),
      $el.text(),
    ].join(' ')
  );
  const textBlock = rawTextBlock
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const rawNestedClasses = ($el.find('.stockgroup, .stock, .availability, .c_product_quantity')
    .map((_: number, node: any) => (((node as any)?.attribs?.class) || ''))
    .get() as string[])
    .join(' ');
  const classBlock = `${String($el.attr('class') || '')} ${rawNestedClasses}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const hasOutOfStockSignal =
    /indispon|nao\s*dispon|esgotad|sem\s*stock|out\s*of\s*stock|unavailable/.test(textBlock) ||
    /\bred\b/.test(classBlock);
  if (hasOutOfStockSignal) {
    return { availability: 0, label: availText || 'Out of stock' };
  }

  const hasStockSignal =
    /dispon|em\s*stock|in\s*stock|available/.test(textBlock) ||
    /\bgreen\b/.test(classBlock);
  if (hasStockSignal) {
    return { availability: 1, label: availText || '>1 in stock' };
  }

  return { availability: null, label: availText || null };
}

function normalizeRepeatedText(raw: string): string {
  const value = collapseWhitespace(raw);
  if (!value) return value;
  const repeated = value.match(/^(.+?)\1+$/);
  if (repeated && repeated[1]) {
    return collapseWhitespace(repeated[1]);
  }
  return value;
}

function normalizeSearchText(raw: string | undefined | null): string {
  return collapseWhitespace(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractGsmartPvpSemIva(text: string | undefined | null): number | null {
  const collapsed = collapseWhitespace(text);
  if (!collapsed) return null;

  const patterns = [
    /PVP\s*\(\s*sem\s*IVA\s*\)\s*([0-9]+(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:€|eur)?/i,
    /PVP\s*\(\s*sin\s*IVA\s*\)\s*([0-9]+(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:€|eur)?/i,
    /PVP\s*(?:sem|sin)\s*IVA\s*[:\-]?\s*([0-9]+(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = collapsed.match(pattern);
    if (match?.[1]) {
      const parsed = parsePrice(match[1]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

function isLikelyActionLabel(line: string): boolean {
  const normalized = normalizeSearchText(line);
  return (
    normalized.includes('ver ficha') ||
    normalized.includes('movimientos') ||
    normalized.includes('meus armazens') ||
    normalized.includes('armazon do fornecedor') ||
    normalized.includes('armazem do fornecedor') ||
    normalized.includes('encontre equivalentes') ||
    normalized.includes('crossover tecdoc') ||
    normalized.includes('comparar') ||
    normalized.includes('veja pvp') ||
    normalized.includes('veja sem iva') ||
    normalized.includes('actualizar disponibilidad') ||
    normalized.includes('atualizar disponibilidade')
  );
}

function extractGsmartNameAndCode($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>): { name: string; code: string | null } {
  const textLines = ($card.text() || '')
    .split(/\r?\n+/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean)
    .filter((line) => !isLikelyActionLabel(line));

  const anchorTexts = $card.find('a')
    .map((_, el) => collapseWhitespace($(el).text()))
    .get()
    .filter(Boolean)
    .filter((line) => !isLikelyActionLabel(line));

  const segmentTexts = $card
    .find('a, div, span, p, td, li, h1, h2, h3, h4, h5, h6')
    .map((_, el) => collapseWhitespace($(el).text()))
    .get()
    .filter(Boolean)
    .filter((line) => line.length <= 180)
    .filter((line) => !isLikelyActionLabel(line));

  const baseCandidates = [...anchorTexts, ...segmentTexts, ...textLines]
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const codeCandidates = baseCandidates
    .filter((line) => /^[A-Z0-9][A-Z0-9 ./_-]{2,24}$/.test(line))
    .filter((line) => !/\b(PVP|IVA|AF|PT)\b/i.test(line));

  const code = codeCandidates.find(Boolean) || null;
  const codeNormalized = code ? normalizeSearchText(code) : null;

  const nameCandidates = baseCandidates
    .filter((line) => line.length >= 6)
    .filter((line) => !/^\d+(?:[.,]\d+)?\s*€?$/.test(line))
    .filter((line) => !/(^|\s)(pvp|liquido|desconto|descuento|disponivel|disponible|veja|comparar|pedido)(\s|$)/i.test(line))
    .filter((line) => !/^\(?\d[\d.,]*\s*U\.?D\.?\)?$/i.test(line))
    .filter((line) => normalizeSearchText(line) !== codeNormalized);

  const name = nameCandidates.find((line) => {
    // Prefer a human description over short codes/labels.
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 || /[a-záàâãéèêíìîóòôõúùûç]/i.test(line);
  }) || nameCandidates[0] || '';

  return { name, code };
}

function extractGsmartUrl($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>, baseUrl: string): string {
  const href = $card.find('a[href]')
    .map((_, el) => ($(el).attr('href') || '').trim())
    .get()
    .find((value) => {
      if (!value) return false;
      if (value.startsWith('#') || /^javascript:/i.test(value)) return false;
      return true;
    });

  if (!href) return baseUrl;
  return extractAbsoluteUrl(href, baseUrl);
}

function parseGsmartCards(html: string, supplier: Supplier): ProductItem[] {
  const $ = cheerio.load(html);
  const baseUrl = supplier.base_url || 'https://eurocomp.gsmart.eu';
  const pvpSemIvaRegex = /PVP\s*\(\s*(?:sem|sin)\s*IVA\s*\)/i;
  const scope = $('#div-listado').first();
  const searchRoot = scope.length ? scope : $('body');
  if (!searchRoot.length) return [];

  const cardRoots: any[] = [];
  const seenRoots = new Set<any>();
  const qualifiesAsCard = (node: any): boolean => {
    const nodeText = collapseWhitespace($(node).text());
    if (!nodeText) return false;
    if (nodeText.length < 30) return false;
    if (!pvpSemIvaRegex.test(nodeText)) return false;
    const pvpSemMatches = nodeText.match(new RegExp(pvpSemIvaRegex.source, 'gi')) || [];
    if (pvpSemMatches.length !== 1) return false;
    if (!/(PVP\s*\(\s*(?:com|con)\s*IVA\s*\)|L[ií]quido|Descuento|Desconto|Comparar|Tecdoc|Dispon[a-z]+)/i.test(nodeText)) return false;
    // Prefer nodes that look like actual product cards, but do not require anchors (some GSMART views use non-anchor labels).
    const richChildCount = $(node).find('a, button, img, input, select').length;
    return richChildCount > 0 || nodeText.length > 120;
  };

  const candidateNodes = searchRoot.find('*').toArray().filter(qualifiesAsCard);
  if (candidateNodes.length === 0) {
    return [];
  }

  for (const root of candidateNodes) {
    if (!root || root.type !== 'tag') continue;
    if (seenRoots.has(root)) continue;
    // Skip wrappers that contain another qualifying candidate (prefer the smallest matching node).
    const hasQualifiedChild = $(root)
      .find('*')
      .toArray()
      .some((child) => child !== root && qualifiesAsCard(child));
    if (hasQualifiedChild) continue;

    const rootText = collapseWhitespace($(root).text());
    if (!rootText) continue;

    seenRoots.add(root);
    cardRoots.push(root);
  }

  const items: ProductItem[] = [];

  for (const root of cardRoots) {
    const $card = $(root);
    const rawText = collapseWhitespace($card.text());
    if (!rawText) continue;

    const price = extractGsmartPvpSemIva(rawText);
    const normalizedText = normalizeSearchText(rawText);
    const hasStoreAvailability =
      (/dispon[a-z]*\s+(?:em|na)\s+loja/.test(normalizedText) || (/dispon/.test(normalizedText) && /loja/.test(normalizedText))) ||
      (/dispon[a-z]*\s+en\s+tienda/.test(normalizedText) || (/dispon/.test(normalizedText) && /tienda/.test(normalizedText)));

    const { name, code } = extractGsmartNameAndCode($, $card);
    if (!name) continue;

    const availability = hasStoreAvailability ? 1 : 0;
    const availability_label = hasStoreAvailability ? '>1' : 'Out of stock';

    items.push({
      name,
      code,
      price,
      availability,
      availability_label,
      delivery: null,
      url: extractGsmartUrl($, $card, baseUrl),
      store: supplier.name,
    });
  }

  const uniqueItems: ProductItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.url}|${item.code || ''}|${item.price ?? 'na'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function getSupplierSpecificSelectors(supplier: Supplier): any {
  const key = getSupplierKey(supplier);
  if (key === 'nipocar') {
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
  if (key === 'casals') {
    return {
      item: 'table.table tbody tr',
      name: 'td:nth-child(2)',
      code: 'td:nth-child(1)',
      price: 'td:nth-child(4)',
      link: 'td:nth-child(6) a',
      availability: 'td:nth-child(1)'
    };
  }
  if (key === 'evoparts') {
    return {
      item: '.c_product_item, .l_product_item, .product-layout, .product-item',
      name: 'h4 a span.ellip-line, h4 span.ellip-line, h4 a, h4, .c_product_text h4 a, .product-name, .name',
      code: 'p.oneline span, p.oneline, .product-reference, .sku, .code',
      price: '.price_box .current_price, .price_box .priceCheck, .price_box .price, .current_price, .price',
      availability: '.stockgroup, .stock, .availability, .c_product_quantity',
      delivery: '.delivery, .prazo, .lead-time',
      link: 'h4 a, .c_product_img a, a[href*="/produto"], a[href*="/product-"], a[href*="/art"]'
    };
  }
  // Seletores específicos para o Auger
  if (key === 'auger') {
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
  if (key === 'martex') {
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
  if (key === 'airfren') {
    return {
      item: '.product-card',
      name: 'h3.product-title a',
      code: '.product-category a',
      price: 'h4.product-price',
      availability: '.product-badge',
      link: 'a.product-thumb',
    };
  }
  if (key === 'ryme') {
    return {
      item: '.product-list-itm',
      name: 'a.title.product-link',
      code: '.product-list-title p:not(:first-child)',
      price: 'app-price-display span, .product-list-price span',
      availability: 'app-stock .dots',
      link: 'a.product-link',
    };
  }
  return supplier.selectors.result_selectors;
}

export function parseHtml(
  html: string,
  supplier: Supplier
): ProductItem[] {
  const supplierKey = getSupplierKey(supplier);

  if (supplierKey === 'gsmart') {
    const gsmartItems = parseGsmartCards(html, supplier);
    if (gsmartItems.length > 0) {
      return gsmartItems;
    }
  }

  const $ = cheerio.load(html);
  let items: ProductItem[] = [];
  const selectors = getSupplierSpecificSelectors(supplier);
  const isMartex = supplierKey === 'martex';
  const isCasals = supplierKey === 'casals';
  const isNipocar = supplierKey === 'nipocar';
  const isEvoParts = supplierKey === 'evoparts';
  const isRyme = supplierKey === 'ryme';
  const isAirFren = supplierKey === 'airfren';
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
      if (supplierKey === 'auger') {
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
    if (isEvoParts) {
      nameText = normalizeRepeatedText(nameText);
    }

    let codeText = selectors.code ? $el.find(selectors.code).first().text().trim() : null;
    if (codeText && codeText.length === 0) codeText = null;
    if (codeText) {
      codeText = codeText.replace(/\s+/g, '').trim();
      if (isEvoParts) {
        const extractedCode = extractEvoPartsCode(codeText);
        if (extractedCode) codeText = extractedCode;
      }
      if (isRyme) {
        codeText = codeText.replace(/^Ref:/i, '').trim();
      }
      if (isAirFren) {
        codeText = codeText.replace(/^Ref\.\s*/i, '').trim();
      }
    }
    if (!codeText) {
      const maybeCode = $el.attr('data-sku')
        || $el.find('.card-result-count, .product-results__shortlist li').first().text().trim();
      codeText = maybeCode ? maybeCode : null;
      if (isEvoParts && codeText) {
        const extractedCode = extractEvoPartsCode(codeText);
        if (extractedCode) codeText = extractedCode;
      }
    }
    if (isEvoParts && !codeText) {
      codeText = extractEvoPartsCode($el.text());
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
        item.availability_label = 'In stock';
      } else if (isRed) {
        item.availability = 0;
        item.availability_label = 'Out of stock';
      }
    }

    if (isNipocar) {
      // If availability text mentions disponibilidade/porto/lisboa, assume in stock; otherwise keep parsed value.
      const availRaw = availText ? availText.toLowerCase() : '';
      if (item.availability === null) {
        if (/dispon/i.test(availRaw) || /porto/.test(availRaw) || /lisboa/.test(availRaw)) {
          item.availability = 1;
          item.availability_label = item.availability_label || 'In stock';
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
        item.availability_label = martexDetails.availabilityLabel;
      }
      if (martexDetails.summary) {
        item.stock_summary = martexDetails.summary;
      }
      if (item.delivery && typeof item.delivery === 'string' && item.delivery.toLowerCase().includes('central')) {
        item.delivery = null;
      }
    }

    if (isEvoParts) {
      const availabilityInfo = parseEvoPartsAvailability($el, availText);
      if (availabilityInfo.availability !== null) {
        item.availability = availabilityInfo.availability;
      }
      if (availabilityInfo.label) {
        item.availability_label = availabilityInfo.label;
      }
    }

    if (isAirFren) {
      const badgeText = (availText || '').toLowerCase().trim();
      if (badgeText.includes('disponible') && !badgeText.includes('no ')) {
        item.availability = 1;
        item.availability_label = 'In stock';
      } else if (badgeText.includes('no disponible') || badgeText.includes('agotado')) {
        item.availability = 0;
        item.availability_label = 'Out of stock';
      }
    }

    if (isRyme) {
      const stockEl = $el.find('app-stock .dots').first();
      const stockClass = stockEl.attr('class') || '';
      const levelMatch = stockClass.match(/level_(\d)/);
      if (levelMatch) {
        const level = parseInt(levelMatch[1], 10);
        item.availability = level > 0 ? 1 : 0;
        item.availability_label = level > 0 ? 'In stock' : 'Out of stock';
      }
    }

    items.push(item);
  });

  // Heuristic fallback for Auger: anchors linking to product-detail
  if (items.length === 0 && supplierKey === 'auger') {
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

/**
 * Parser dedicado para o formato de listagem do Nipocar.
 * Anteriormente em scraper.ts — movido aqui para centralizar todos os parsers HTML.
 */
export function parseNipocar(html: string, supplier: Supplier): ProductItem[] {
  const $ = cheerio.load(html);
  const items: ProductItem[] = [];
  const baseUrl = supplier.base_url || 'https://nipocar.pt';

  $('.winsig_product_item_list_custom').each((_, el) => {
    const container = $(el);

    const name = container.find('.product_name').first().text().trim()
      || container.find('.se-item-reference').first().text().trim()
      || '';
    const code = container.find('.se-item-reference a').first().text().trim()
      || container.find('input[id^="input_qtd_"]').attr('ref')
      || null;

    const priceTextCandidates = [
      container.find('.price_two span').first().text(),
      container.find('.price_two.value.price span').first().text(),
      container.find('.productListNoIvaPrice .price span').first().text(),
      container.find('.price_two').first().text(),
      container.find('[class*=price]').first().text(),
    ]
      .map((t) => t?.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

    let price: number | null = null;
    for (const pt of priceTextCandidates) {
      const p = parsePrice(pt);
      if (p !== null) { price = p; break; }
    }

    if (price === null) {
      const onclick = container.find('button[onclick*="add_to_cart_Advance3"]').attr('onclick') || '';
      const m = onclick.match(/add_to_cart_Advance3\([^,]+,'([^']+)'/);
      const payload = m ? m[1] : null;
      if (payload) {
        const parts = payload.split('_P_');
        if (parts.length >= 3) {
          const p = parsePrice(parts[2]);
          if (p !== null) price = p;
        }
      }
    }

    if (price === null) {
      const text = container.text() || '';
      const currencyRegex = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:\u20ac|€|eur|euro)/gi;
      let m;
      while ((m = currencyRegex.exec(text)) !== null) {
        const p = parsePrice(m[1]);
        if (p !== null) { price = p; break; }
      }
    }

    const hasStockGreen = container.find('.stockgroup .stock.green').length > 0;
    const availability = hasStockGreen ? 1 : 0;
    const availability_label = hasStockGreen ? 'In stock' : 'Out of stock';

    const href = container.find('.se-item-reference a').attr('href') || '';
    const url = extractAbsoluteUrl(href, baseUrl) || baseUrl;

    items.push({ name, code, price, availability, availability_label, delivery: null, url, store: supplier.name });
  });

  return items;
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


