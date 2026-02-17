// Encrypt supplier_credentials.password where stored as plaintext.
// Uses backend encryption util (AES-256-GCM) and Supabase service role.

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const sb = createClient(url, key);

  const { data: rows, error } = await sb
    .from('supplier_credentials')
    .select('id,name,password');
  if (error) throw error;

  const { encryptPassword } = require('./backend/dist/utils/secrets.js');

  let updated = 0;
  for (const row of rows || []) {
    const pwd = row.password || '';
    if (pwd && !String(pwd).startsWith('enc:')) {
      const enc = encryptPassword(String(pwd));
      const { error: upErr } = await sb
        .from('supplier_credentials')
        .update({ password: enc })
        .eq('id', row.id);
      if (upErr) {
        console.warn('Failed to encrypt credential for', row.name, upErr.message);
        continue;
      }
      updated++;
    }
  }

  console.log(`Encrypted ${updated} credential(s).`);
}

main().catch((e) => { console.error('Encryption script error:', e.message); process.exit(1); });

