const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('backend/debug-ab48a61e.html','utf8');
const $ = cheerio.load(html);
console.log('cards', $('.product-card').length);
console.log('legacy items', $('.product-item, tr.product, .search-result-item').length);
