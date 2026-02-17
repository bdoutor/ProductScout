// One-off migration: copy plaintext login/password/url from 'suppliers' table
// into 'supplier_credentials' with encryption, then (optionally) blank password fields in suppliers.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });
require('dotenv').config();

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Aborting.');
    process.exit(1);
  }
  const sb = createClient(url, key);

  console.log('Reading suppliers with inline credentials...');
  const { data: suppliers, error } = await sb
    .from('suppliers')
    .select('*');
  if (error) throw error;

  const { encryptPassword } = require('./backend/dist/utils/secrets.js');

  let inserted = 0;
  for (const s of suppliers || []) {
    if (!s.login || !s.password) continue;
    // Check existing credential
    const { data: existing } = await sb
      .from('supplier_credentials')
      .select('id')
      .eq('name', s.name)
      .maybeSingle();
    if (existing) continue;

    const enc = encryptPassword(String(s.password));
    const payload = {
      name: s.name,
      login: String(s.login),
      password: enc,
      url: String(s.login_url || s.url || s.base_url || ''),
      notes: s.notes || null,
      active: true,
    };
    const { error: insertErr } = await sb.from('supplier_credentials').insert(payload);
    if (insertErr) {
      console.warn('Failed to insert credential for', s.name, insertErr.message);
      continue;
    }
    inserted++;
  }

  console.log(`Inserted ${inserted} supplier_credentials.`);
  console.log('Done. You may now remove plaintext passwords from suppliers if desired.');
}

main().catch((e) => {
  console.error('Migration error:', e);
  process.exit(1);
});

