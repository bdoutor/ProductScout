-- Fix 6: Add auth_mode column to suppliers table
-- Run once in the Supabase SQL editor.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS auth_mode text DEFAULT 'none';

UPDATE suppliers SET auth_mode = 'manual' WHERE supplier_key = 'gsmart';
UPDATE suppliers SET auth_mode = 'auto'   WHERE supplier_key IN ('auger', 'nipocar', 'martex', 'casals', 'evoparts');

-- Verify:
SELECT supplier_key, name, auth_mode FROM suppliers ORDER BY supplier_key;
