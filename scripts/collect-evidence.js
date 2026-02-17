// Collect latest run evidence into logs/evidence/<timestamp>
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function main() {
  const outDir = path.join(__dirname, '..', 'logs', 'evidence', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(outDir, { recursive: true });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: runs, error } = await sb
    .from('search_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;

  fs.writeFileSync(path.join(outDir, 'search_runs.json'), JSON.stringify(runs, null, 2));

  const latest = runs && runs[0];
  if (latest && latest.debug_snapshot_url) {
    const html = await axios.get(latest.debug_snapshot_url, { timeout: 20000 }).then(r => r.data).catch(()=>null);
    if (html) fs.writeFileSync(path.join(outDir, 'snapshot.html'), html);
  }

  console.log('[evidence] saved to', outDir);
}

main().catch(e => { console.error('[evidence] error:', e.message); process.exit(1); });

