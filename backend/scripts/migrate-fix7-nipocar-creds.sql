-- Fix 7: Move Nipocar credentials from .env to supplier_credentials table
-- Replace <NIPOCAR_LOGIN> and <NIPOCAR_PASSWORD> with the real values before running.
-- The password value should match what you have in NIPOCAR_LOGIN / NIPOCAR_PASSWORD in .env.

INSERT INTO supplier_credentials (name, login, password, url, active)
VALUES (
  'nipocar',              -- must match suppliers.name (case-insensitive match in code)
  '<NIPOCAR_LOGIN>',
  '<NIPOCAR_PASSWORD>',   -- plain text; the code calls decryptPassword() which is a no-op if not encrypted
  'https://nipocar.pt',   -- adjust to real login URL if different
  true
)
ON CONFLICT (name) DO UPDATE
  SET login    = EXCLUDED.login,
      password = EXCLUDED.password,
      active   = true;

-- After running, remove NIPOCAR_LOGIN and NIPOCAR_PASSWORD from backend/.env
-- and restart the backend.

-- Verify:
SELECT name, login, active FROM supplier_credentials WHERE name = 'nipocar';
