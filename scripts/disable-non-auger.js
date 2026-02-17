// Disable all suppliers except AUGER in Supabase
// Usage: node scripts/disable-non-auger.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const txt = fs.readFileSync(file, 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

(async () => {
  // Prefer backend/.env for service key
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  const env = Object.assign({}, process.env, loadEnv(envPath));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const sb = createClient(url, key);
  // Disable all suppliers except AUGER
  const { error: e1 } = await sb.from('suppliers').update({ enabled: false }).neq('name', 'AUGER');
  if (e1) { console.error('Update non-AUGER failed:', e1.message); process.exit(1); }
  const { error: e2 } = await sb.from('suppliers').update({ enabled: true }).eq('name', 'AUGER');
  if (e2) { console.error('Enable AUGER failed:', e2.message); process.exit(1); }
  console.log('Suppliers updated: only AUGER enabled.');
})();

