// Analyze latest debug snapshot HTML and suggest CSS selectors
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function getLatestSnapshotUrl() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from('search_runs')
    .select('id, debug_snapshot_url, created_at')
    .not('debug_snapshot_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data && data[0];
  if (!row) throw new Error('No snapshot found');
  return row.debug_snapshot_url;
}

function suggestSelectors($) {
  // find repeated product-like cards: look for elements with image + title/link nearby
  const candidates = [];
  $('a,div,li,article,section').each((_, el) => {
    const $el = $(el);
    const children = $el.find('a, img, h1, h2, h3, .price, [class*="price"]');
    if (children.length >= 3) {
      const cls = $el.attr('class') || '';
      const tag = el.tagName || el.name || 'el';
      const sel = cls ? `${tag}.${cls.trim().split(/\s+/).join('.')}` : tag;
      candidates.push(sel);
    }
  });
  // Frequency count
  const freq = candidates.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {});
  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([s,c])=>({sel:s,count:c}));

  // Try likely item container
  let item = null;
  for (const c of sorted) {
    if (/(product|card|item|result|grid)/i.test(c.sel) && !/__next|route|header|footer|nav/i.test(c.sel)) {
      item = c.sel;
      break;
    }
  }
  if (!item) item = sorted[0]?.sel || 'div';

  // Within the first item, guess name/price/link
  const first = $(item).first();
  const nameSel = ['.product-title a','a.product-title','h3 a','h2 a','a[href*="/product" ]','a'].find(s=>first.find(s).length>0) || 'a';
  const priceSel = ['.price','.product-price','.net-price','[class*="price"]'].find(s=>first.find(s).length>0) || '.price';
  const linkSel = nameSel;

  return { item, name: nameSel, price: priceSel, link: linkSel, top: sorted };
}

async function main() {
  const url = await getLatestSnapshotUrl();
  console.log('Snapshot:', url);
  const resp = await axios.get(url, { timeout: 20000 });
  const html = resp.data;
  const $ = cheerio.load(html);
  const suggest = suggestSelectors($);
  console.log('Suggested selectors:', suggest);
}

main().catch(e => { console.error('analyze error:', e.message); process.exit(1); });

