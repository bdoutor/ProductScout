-- ============================================================================
-- Update Continente Supplier Configuration
-- ============================================================================
-- This script updates the Continente supplier to use render mode
-- and improves CSS selectors for better product extraction
-- ============================================================================

-- Update Continente to use render mode with improved selectors
UPDATE public.suppliers
SET
  mode = 'render',
  selectors = jsonb_build_object(
    'result_selectors', jsonb_build_object(
      'item', '.product-list__item, .product-card, .ct-product-card, [data-product], .product-tile',
      'name', '.product-card__title, .ct-tile__title, .product-name, .product-title, h3, h4',
      'code', '[data-sku], .product-sku, .sku, [data-product-id]',
      'price', '.price, .ct-price__value, .product-card__price, .product-price, .price-value, [data-price]',
      'availability', '.availability, .stock, .stock-status, .product-availability',
      'delivery', '.delivery, .eta, .shipping, .delivery-info',
      'link', 'a[href]'
    )
  ),
  updated_at = NOW()
WHERE LOWER(name) = 'continente';

-- Verify the update
SELECT
  name,
  mode,
  enabled,
  search_url_template,
  selectors->'result_selectors' as result_selectors,
  updated_at
FROM public.suppliers
WHERE LOWER(name) = 'continente';
