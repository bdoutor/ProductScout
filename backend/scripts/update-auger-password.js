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

function getKey() {
  const crypto = require('crypto');
  const fromEnv = process.env.SUPPLIER_CREDS_ENC_KEY;
  if (fromEnv) {
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(fromEnv)) {
        const b = Buffer.from(fromEnv, 'base64');
        if (b.length === 32) return b;
      }
      const hex = Buffer.from(fromEnv, 'hex');
      if (hex.length === 32) return hex;
    } catch (err) {}
  }
  const base = process.env.SESSION_SECRET || 'change-me-dev';
  return require('crypto').createHash('sha256').update(base).digest();
}

function encryptPassword(plaintext) {
  const crypto = require('crypto');
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

(async () => {
  const plain = process.env.NEW_AUGER_PASSWORD;
  if (!plain) {
    console.error('NEW_AUGER_PASSWORD env variable is required');
    process.exit(1);
  }

  ensureSupabaseEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    console.error('Supabase credentials missing');
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, key);

  const encrypted = encryptPassword(plain);

  const { data, error } = await client
    .from('supplier_credentials')
    .update({ password: encrypted })
    .eq('name', 'AUGER')
    .select('id, name, password');

  if (error) {
    console.error('Supabase update failed:', error.message);
    process.exit(1);
  }

  console.log('Updated credentials for AUGER:', data);
  console.log('Encrypted password:', encrypted);
})();
