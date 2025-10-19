-- Update Continente selectors with correct ones
UPDATE suppliers
SET selectors = '{
  "result_selectors": {
    "item": ".product",
    "name": "h2",
    "price": ".price",
    "link": "a"
  }
}'::jsonb
WHERE name = 'Continente';
