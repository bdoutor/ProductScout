const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('Backend/gsmart-results.html','utf8');
const $ = cheerio.load(html);
console.log('tr count', $('tr').length);
console.log('table classes', $('table').map((i,el)=>$(el).attr('class')).get().filter(Boolean));
$('tr').slice(0,5).each((i,el)=>console.log('row', i, $(el).text().trim().slice(0,200)));
