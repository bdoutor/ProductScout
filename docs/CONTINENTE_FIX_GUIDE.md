# Continente Supplier Fix Guide

## Problem Summary

The Continente supplier was failing with:
- **Status:** error
- **Step Failed:** search
- **Error Type:** BLOCKED_BY_ROBOT
- **Error Details:** Page appears to be blocking automated access
- **HTTP Status:** 200

Even though the URL works fine in a browser: https://www.continente.pt/pesquisa/?q=arroz

## Implemented Solutions

### 1. ✅ Automatic HTTP → Render Fallback

**What was done:**
- Created `backend/src/utils/fetch-helpers.ts` with enhanced bot detection
- Updated `backend/src/services/scraper.ts` to automatically retry with render mode when HTTP is blocked
- The system now detects blocking patterns and switches to Firecrawl automatically

**How it works:**
1. Supplier tries HTTP fetch first
2. Checks HTML for blocking indicators (captcha, cloudflare, etc.)
3. If blocked AND Firecrawl API key is configured, automatically retries with render mode
4. Logs the fallback attempt for debugging

**Code snippet:**
```typescript
if (looksLikeRobotBlock(html)) {
  console.log(`[${supplier.name}] HTTP blocked, attempting render fallback...`);

  if (process.env.FIRECRAWL_API_KEY) {
    fetchResult = await fetchRender(searchUrl, 15000);
    usedRenderFallback = true;
    searchRun.engine = 'render';
  }
}
```

### 2. ✅ Enhanced Robot Detection

**New detection keywords added:**
- captcha
- are you human
- access denied
- deny access
- temporarily blocked
- bot detected
- blocked by
- cf-chl- (Cloudflare challenge)
- akamai bot manager
- request unsuccessful
- checking your browser
- security check
- unusual traffic
- automated requests

### 3. ✅ Improved Firecrawl Configuration

**What was done:**
- Increased wait time from 2000ms to 3500ms for JS-heavy sites
- Added configurable `waitFor` parameter
- Better error handling for Firecrawl failures

### 4. ✅ SQL Script to Update Continente

**Location:** `supabase/update-continente.sql`

**What it does:**
- Changes mode from 'http' to 'render'
- Updates CSS selectors with multiple fallback options
- Sets timestamp for tracking changes

## Next Steps - User Actions Required

### Option A: Use Automatic Fallback (Recommended)

If you have a Firecrawl API key:

1. **Update .env file:**
   ```bash
   # Uncomment and add your key
   FIRECRAWL_API_KEY=fc-your-actual-key-here
   ```

2. **Restart backend:**
   ```bash
   # Stop current backend (Ctrl+C in terminal)
   cd backend
   npm run dev
   ```

3. **Test search:**
   - The system will automatically use render mode when blocked
   - No database changes needed!
   - Check console logs to see fallback in action

### Option B: Configure Continente to Always Use Render Mode

If you don't have Firecrawl or want Continente to always use render:

1. **Run SQL in Supabase:**
   - Go to Supabase Dashboard → SQL Editor
   - Run the script in `supabase/update-continente.sql`
   - Or run this single command:

   ```sql
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
     )
   WHERE LOWER(name) = 'continente';
   ```

2. **Add Firecrawl key to .env** (as in Option A)

3. **Restart backend**

### Option C: Keep HTTP Mode (Not Recommended)

If you can't use Firecrawl:

1. **Update selectors only** (in Supabase):
   ```sql
   UPDATE public.suppliers
   SET selectors = jsonb_build_object(...)
   WHERE LOWER(name) = 'continente';
   ```

2. **Accept that Continente may be unreliable** due to anti-bot protection

## Testing the Fix

### 1. Test Individual Supplier

Get the Continente supplier ID first:
```sql
SELECT id, name, mode, enabled FROM suppliers WHERE name = 'Continente';
```

Then test via API:
```bash
curl -X POST http://localhost:3001/api/test-supplier \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "YOUR-CONTINENTE-UUID",
    "query": "arroz",
    "debug": true
  }'
```

**Expected results:**
- `status: "success"`
- `items_found > 0`
- `engine: "render"` (if using render mode or fallback was triggered)
- `debug_snapshot_url` available for inspection

### 2. Test Full Search

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "arroz",
    "debug": false
  }'
```

Check `per_supplier` array for Continente status.

### 3. Use Frontend

1. Open http://localhost:3000
2. Search for "arroz"
3. Check the "Stores Status" section
4. Continente should show:
   - Status: success ✅
   - Items found: > 0
5. If it shows error, click "View details" to see diagnostics

## Troubleshooting

### Still Getting BLOCKED_BY_ROBOT?

1. **Verify Firecrawl key is valid:**
   ```bash
   curl -X POST https://api.firecrawl.dev/v0/scrape \
     -H "Authorization: Bearer YOUR-KEY" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'
   ```

2. **Check backend logs:**
   - Look for "[Continente] HTTP blocked, attempting render fallback..."
   - If you don't see this, the detection might not be triggering

3. **Inspect debug snapshot:**
   - Open the snapshot URL from diagnostics
   - Look for actual HTML structure
   - Check if selectors match real elements

### Getting PARSING_ERROR (No Items Found)?

1. **Open debug snapshot** from diagnostics modal

2. **Inspect HTML structure** in browser DevTools

3. **Find actual selectors:**
   - Product container: Look for repeated elements
   - Product name: Usually in `<h3>`, `<h4>`, or class with "title"
   - Price: Look for class with "price" or data attributes
   - Link: Find the `<a>` tag that wraps the product

4. **Update selectors in Supabase:**
   ```sql
   UPDATE suppliers
   SET selectors = jsonb_build_object(
     'result_selectors', jsonb_build_object(
       'item', '.your-actual-item-selector',
       'name', '.your-actual-name-selector',
       -- etc.
     )
   )
   WHERE name = 'Continente';
   ```

### Firecrawl API Errors?

- **401 Unauthorized:** Invalid API key
- **429 Too Many Requests:** Rate limit exceeded (wait or upgrade plan)
- **Timeout:** Increase timeout in scraper or reduce `waitFor` time

## File Changes Summary

### New Files Created:
1. ✅ `backend/src/utils/fetch-helpers.ts` - Enhanced bot detection
2. ✅ `supabase/update-continente.sql` - SQL update script
3. ✅ `CONTINENTE_FIX_GUIDE.md` - This guide

### Modified Files:
1. ✅ `backend/src/services/scraper.ts`
   - Added automatic HTTP → Render fallback
   - Imported `looksLikeRobotBlock` helper
   - Improved logging for debugging
   - Increased render wait time to 3500ms

## Expected Outcome

✅ **Continente searches should now:**
- Succeed with `status: "success"`
- Return actual products (items > 0)
- Use render mode automatically when HTTP is blocked
- Provide debug snapshots for further tuning

✅ **Backend should:**
- Auto-fallback from HTTP to render when blocked
- Log fallback attempts for monitoring
- Work with or without Firecrawl (with degraded performance)

✅ **Diagnostics should show:**
- Engine: "render" (when fallback is used)
- Actual HTML snapshots for inspection
- Detailed error info if still failing

## Getting Firecrawl API Key

1. Go to https://www.firecrawl.dev/
2. Sign up for free account
3. Get API key from dashboard
4. Free tier usually includes:
   - 500 requests/month
   - Sufficient for testing and small usage

## Alternative Solutions (If Firecrawl Doesn't Work)

1. **Playwright/Puppeteer:** Run your own headless browser
2. **ScraperAPI:** Alternative rendering service
3. **Proxy rotation:** Use rotating proxies with HTTP mode
4. **Official API:** Check if Continente provides an official API

---

**Need help?** Check the backend logs for detailed error messages and fallback attempts.
