const crypto = require("crypto");
const enc = process.argv[2];
const session = process.argv[3] || 'change-me-dev';
const base = session;
const KEY = crypto.createHash('sha256').update(base).digest();
function decryptPassword(stored) {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored;
  const buf = Buffer.from(stored.slice(4), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  console.log(dec.toString('utf8'));
}
decryptPassword(enc);
