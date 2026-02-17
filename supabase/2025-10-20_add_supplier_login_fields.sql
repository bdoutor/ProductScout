-- Add optional login fields to suppliers table for headless login flows
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS login_url text,
  ADD COLUMN IF NOT EXISTS login_selector text,
  ADD COLUMN IF NOT EXISTS password_selector text,
  ADD COLUMN IF NOT EXISTS submit_selector text;

-- Optional legacy compatibility: some schemas used 'url' to mean login page.
-- Keep as-is; provider resolves priority: login_url -> credentials.url -> base_url.

-- Notes:
-- - Do NOT store plaintext passwords here in production. Use supplier_credentials table instead.
-- - When filled, selectors should be valid CSS selectors for the login form elements.

