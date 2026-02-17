# Release Notes

## v2.0.0-alpha.2 · 2025-10-24

- Stabilized the Auger Playwright login flow with resilient selectors, cookie-based reuse and automatic relogin so `/api/search` returns live supplier results without manual retries.
- Updated the Auger HTML parser to recognise the new `product-card` markup, de-duplicate products and surface price/stock information in the UI grid.
- Added a Martex Playwright provider with cached sessions (login `EC01`/`martex1234`) so the portal is scraped end-to-end with minimal latency.
- Enabled real end-to-end testing for reference `364624`, confirming the backend and frontend now present actual supplier data.

Previous release: `v2.0.0-alpha.1`.
