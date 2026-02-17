const cheerio=require('cheerio'); const parser=require('./dist/utils/parser');
function parseNipocar(html, supplier) {
    const $ = cheerio.load(html);
    const items = [];
    const baseUrl = supplier.base_url || 'https://nipocar.pt';
    $('.winsig_product_item_list_custom').each((_, el) => {
        const container = $(el);
        const name = container.find('.product_name').first().text().trim() ||
            container.find('.se-item-reference').first().text().trim() ||
            '';
        const code = container.find('.se-item-reference a').first().text().trim() ||
            container.find('input[id^="input_qtd_"]').attr('ref') ||
            null;
        const priceTextCandidates = [
            container.find('.price_two span').first().text(),
            container.find('.price_two.value.price span').first().text(),
            container.find('.productListNoIvaPrice .price span').first().text(),
            container.find('.price_two').first().text()
        ]
            .map(t => t?.trim().replace(/\s+/g, ' '))
            .filter(Boolean);
        let price = null;
        for (const pt of priceTextCandidates) {
            const p = (0, parser_1.parsePrice)(pt);
            if (p !== null) {
                price = p;
                break;
            }
        }
        if (price === null) {
            const onclick = container.find('button[onclick*="add_to_cart_Advance3"]').attr('onclick') || '';
            const m = onclick.match(/add_to_cart_Advance3\([^,]+,'([^']+)'/);
            const payload = m ? m[1] : null;
            if (payload) {
                const parts = payload.split('_P_');
                if (parts.length >= 3) {
                    const p = (0, parser_1.parsePrice)(parts[2]);
                    if (p !== null)
                        price = p;
                }
            }
        }
        if (price === null) {
            const text = container.text() || '';
            const currencyRegex = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(€|â‚¬|eur|euro)/gi;
            let m;
            while ((m = currencyRegex.exec(text)) !== null) {
                const p = (0, parser_1.parsePrice)(m[1]);
                if (p !== null) {
                    price = p;
                    break;
                }
            }
        }
        const hasStockGreen = container.find('.stockgroup .stock.green').length > 0;
        const availability = hasStockGreen ? 1 : 0;
        const availability_label = hasStockGreen ? 'In stock' : 'Out of stock';
        const href = container.find('.se-item-reference a').attr('href') || '';
        const url = (0, parser_1.extractAbsoluteUrl)(href, baseUrl) || baseUrl;
        items.push({ name, code, price, availability, availability_label, delivery: null, url, store: supplier.name });
    });
    return items;
}
/**
 * Scrape a single supplier for the given query
 */
async 
module.exports=parseNipocar;
