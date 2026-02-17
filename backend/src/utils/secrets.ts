import crypto from 'crypto';

function getKey(): Buffer {
  const fromEnv = process.env.SUPPLIER_CREDS_ENC_KEY;
  if (fromEnv) {
    try {
      // Support base64 or hex; default to base64
      if (/^[A-Za-z0-9+/=]+$/.test(fromEnv)) {
        const b = Buffer.from(fromEnv, 'base64');
        if (b.length === 32) return b;
      }
      const hex = Buffer.from(fromEnv, 'hex');
      if (hex.length === 32) return hex;
    } catch {}
  }
  // Fallback derive from SESSION_SECRET (dev only)
  const base = process.env.SESSION_SECRET || 'change-me-dev';
  return crypto.createHash('sha256').update(base).digest(); // 32 bytes
}

const KEY = getKey();

export function encryptPassword(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString('base64');
  return `enc:${payload}`;
}

export function decryptPassword(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored; // legacy/plain
  const buf = Buffer.from(stored.slice(4), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

