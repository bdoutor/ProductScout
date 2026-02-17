// Test AUGER end-to-end: fetch supplier id from Supabase, then call backend /api/test-supplier
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });

async function getSupplierIdByName(name) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const sb = createClient(url, key);
  const { data, error } = await sb.from('suppliers').select('id,name').ilike('name', name).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Supplier not found: ${name}`);
  return data.id;
}

async function main() {
  const supplierId = await getSupplierIdByName('AUGER');
  const backend = process.env.BACKEND_BASE || 'http://localhost:3001';
  const query = process.argv[2] || 'filtro oleo';
  console.log('Testing supplier', supplierId, 'with query', query);
  const res = await axios.post(`${backend}/api/test-supplier`, { supplier_id: supplierId, query, debug: true }, { timeout: 60000 });
  console.log('Status run:', res.data?.search_run?.status, 'items:', (res.data?.items || []).length);
}

main().catch((e) => { console.error('Test error:', e?.response?.data || e.message); process.exit(1); });

