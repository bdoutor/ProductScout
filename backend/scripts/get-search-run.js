require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');

function ensureSupabaseEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const backupPath = path.resolve('backend/.env.backup');
  if (!fs.existsSync(backupPath)) return;
  const lines = fs.readFileSync(backupPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

(async () => {
  ensureSupabaseEnv();
  const runId = process.env.SEARCH_RUN_ID;
  if (!runId) {
    console.error('Set SEARCH_RUN_ID env variable.');
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    console.error('Supabase credentials missing');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, key);
  const { data, error } = await client
    .from('search_runs')
    .select('*')
    .eq('id', runId)
    .single();
  if (error) {
    console.error('Error fetching search run:', error.message);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
})();
