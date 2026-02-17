-- Seed suppliers and credentials for AUGER, GSMART, Martex
-- NOTE: This stores credentials in supplier_credentials (not in suppliers).
-- Review and adjust search_url_template and selectors to match each portal.

-- Suppliers (idempotent upsert by name)
INSERT INTO suppliers (enabled, name, base_url, mode, search_url_template, login_url, selectors)
VALUES
  (
    true,
    'AUGER',
    'https://portal.iamauger.com',
    'render',
    'https://portal.iamauger.com/search?q={query}', -- TODO: confirm real search URL
    'https://portal.iamauger.com/login',
    '{
      "result_selectors": {
        "item": ".product-item",
        "name": ".product-title",
        "price": ".price",
        "link": ".product-title a"
      }
    }'
  ),
  (
    true,
    'GSMART',
    'https://eurocomp.gsmart.eu',
    'render',
    'https://eurocomp.gsmart.eu/search?q={query}', -- TODO: confirm
    'https://eurocomp.gsmart.eu/usuarios/log',
    '{
      "result_selectors": {
        "item": ".product-item",
        "name": ".product-title",
        "price": ".price",
        "link": ".product-title a"
      }
    }'
  ),
  (
    true,
    'Martex',
    'https://martex.pt',
    'render',
    'https://martex.pt/?s={query}', -- TODO: confirm
    'https://martex.pt',
    '{
      "result_selectors": {
        "item": ".product",
        "name": ".woocommerce-loop-product__title",
        "price": ".price",
        "link": "a.woocommerce-LoopProduct-link"
      }
    }'
  )
ON CONFLICT (name) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  base_url = EXCLUDED.base_url,
  mode = EXCLUDED.mode,
  search_url_template = EXCLUDED.search_url_template,
  login_url = EXCLUDED.login_url,
  selectors = EXCLUDED.selectors;

-- Credentials (plaintext for initial insert; run encrypt-existing-credentials.js afterwards)
INSERT INTO supplier_credentials (name, login, password, url, notes, active)
VALUES
  ('AUGER', 'valdemar@eurocomponentes.pt', 'Euro1999*', 'https://portal.iamauger.com/login', 'Portal AUGER - Automotive parts supplier', true),
  ('GSMART', 'valdemar craveiro', 'Euro1999', 'https://eurocomp.gsmart.eu/usuarios/log', 'Portal GSMART - Automotive parts supplier', true),
  ('Martex', 'EC01', 'martex1234', 'https://martex.pt', 'Portal Martex - Automotive parts supplier', true)
ON CONFLICT (name) DO UPDATE SET
  login = EXCLUDED.login,
  password = EXCLUDED.password,
  url = EXCLUDED.url,
  notes = EXCLUDED.notes,
  active = EXCLUDED.active;

