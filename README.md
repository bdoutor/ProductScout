# ProductScout

> **Version 1.0 - Proof of Concept**
> Universal product lookup & comparison tool for Portuguese retailers

**ProductScout** searches multiple Portuguese retailers simultaneously and displays a unified, sortable results table with pricing, availability, delivery info, and direct product links.

**Note:** This is v1.0 POC - supports public websites only. For authenticated/session-based searches, see v2.0.

## Features

- **Multi-store Search**: Query multiple retailers in parallel (FNAC, Rádio Popular, Continente, Lidl, etc.)
- **Universal Results**: Aggregated, normalized, and sorted product listings
- **Smart Sorting**: Available items first (by price), unavailable items last
- **Error Handling**: Per-store error isolation with detailed diagnostics
- **Observability**: Full search run tracking with debug snapshots
- **Configurable**: Add new stores via database configuration (no code changes)
- **Two Fetch Modes**: HTTP fetch for static pages, render/crawl for JavaScript-heavy sites

## Architecture

- **Frontend**: Next.js 14 (React) with Tailwind CSS
- **Backend**: Node.js + TypeScript + Express
- **Database**: Supabase (PostgreSQL + Storage)
- **Scraping**: Cheerio for HTML parsing, optional Firecrawl for rendered pages
- **Caching**: In-memory cache with configurable TTL (5-15 minutes)

## Project Structure

```
ProductScout/
├── backend/               # Node.js API service
│   ├── src/
│   │   ├── routes/       # Express routes (search, test-supplier)
│   │   ├── services/     # Scraper service
│   │   ├── types/        # TypeScript types
│   │   ├── utils/        # Parser, Supabase client
│   │   └── index.ts      # Main server
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/             # Next.js web app
│   ├── src/
│   │   ├── app/         # App router pages
│   │   ├── components/  # React components
│   │   ├── styles/      # Global CSS
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # API client
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.local.example
│
└── supabase/
    └── schema.sql        # Database schema + sample suppliers
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- (Optional) Firecrawl API key for render mode

### ⚡ Method 1: One-Click Start (NOVO - Recomendado!)

**Duplo-clique em:** `START-PRODUCTSCOUT.bat`

Isto irá:
1. ✅ Verificar e limpar processos antigos
2. ✅ Iniciar o backend (porta 3001)
3. ✅ Iniciar o frontend (porta 3000)
4. ✅ Abrir automaticamente o browser
5. ✅ Gerar logs detalhados

**Pronto em ~15 segundos!** 🚀

Para parar tudo: **Duplo-clique em:** `stop-all.bat`

📖 **Ver guia completo:** [docs/COMO-USAR.md](docs/COMO-USAR.md)

### Method 2: Using Legacy Startup Script

1. **Configure environment variables** (see section below)
2. **Double-click** `start-dev.bat` in the project root (if exists)
3. **Wait** for both services to start
4. **Browser opens automatically** at http://localhost:3000

### Method 2: Visual Studio F5 Debug

1. **Press F5** in Visual Studio to start the ASP.NET Core container
2. **Follow instructions** on the page that opens
3. **Close debugger** and run `start-dev.bat`

### Method 3: Manual Start

```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000

## Detailed Setup Instructions

### 1. Clone and Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Go to **Storage** → Create bucket named `debug-snapshots` (public read access)
4. Get your credentials from **Project Settings** → **API**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (from Service Role tab)

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3001
NODE_ENV=development

# Supabase (required)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firecrawl (optional, for render mode)
FIRECRAWL_API_KEY=your-firecrawl-key

# Cache & rate limiting
CACHE_TTL_SECONDS=600
MAX_CONCURRENT_REQUESTS=3
REQUEST_DELAY_MS=1000
```

### 4. Configure Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 5. Run the Application

See **Quick Start** section above for three different methods to run the application.

## API Endpoints

### `POST /api/search`

Search all enabled suppliers for a query.

**Request:**
```json
{
  "query": "arroz carolino 1kg",
  "debug": false
}
```

**Response:**
```json
{
  "query": "arroz carolino 1kg",
  "items": [
    {
      "name": "Arroz Carolino Extra 1kg",
      "code": "1234567",
      "price": 1.99,
      "availability": 10,
      "delivery": "2-3 days",
      "url": "https://...",
      "store": "Continente"
    }
  ],
  "per_supplier": [
    {
      "supplier_name": "Continente",
      "status": "success",
      "items_found": 12,
      "search_run_id": "uuid"
    }
  ],
  "message": "Optional message"
}
```

### `POST /api/test-supplier`

Test a single supplier with full diagnostics.

**Request:**
```json
{
  "supplier_id": "uuid",
  "query": "SSD NVMe 1TB",
  "debug": true
}
```

**Response:**
```json
{
  "search_run": {
    "id": "uuid",
    "status": "success|error",
    "step_failed": "search|extract",
    "error_message": "NETWORK_ERROR",
    "error_details": "...",
    "search_url_effective": "https://...",
    "http_status_search": 200,
    "durations": { "search_ms": 1234, "extract_ms": 56, "total_ms": 1290 },
    "selector_counts": { "items": 8 },
    "debug_snapshot_url": "https://..."
  },
  "items": [...]
}
```

### `GET /api/search-runs/:id`

Get details of a specific search run.

### `GET /api/suppliers`

List all suppliers.

## Adding New Suppliers

To add a new store, insert a row into the `suppliers` table:

```sql
INSERT INTO suppliers (name, base_url, mode, search_url_template, enabled, selectors)
VALUES (
  'Example Store',
  'https://www.example.com',
  'http',
  'https://www.example.com/search?q={query}',
  true,
  '{
    "result_selectors": {
      "item": ".product-card",
      "name": ".product-title",
      "code": ".sku",
      "price": ".price-value",
      "availability": ".stock-status",
      "delivery": ".delivery-info",
      "link": "a.product-link"
    }
  }'::jsonb
);
```

**Steps:**

1. Inspect the store's HTML structure
2. Find CSS selectors for each field (use browser DevTools)
3. Test with `/api/test-supplier` endpoint
4. Adjust selectors until parsing works correctly
5. Set `enabled = true`

## Configuring Selectors

CSS selectors must match the retailer's HTML. Use the **Diagnostics** tab and **View details** to debug extraction failures.

**Required selectors:**
- `item` - Container for each product (e.g., `.product-card`)
- `name` - Product name
- `price` - Price text
- `link` - Product URL (`href` attribute)

**Optional selectors:**
- `code` - SKU/product code
- `availability` - Stock status
- `delivery` - Delivery info

## Error Classification

The system classifies errors into:

- **NETWORK_ERROR**: DNS, timeout, connection issues
- **HTTP_ERROR**: Non-2xx HTTP status
- **PARSING_ERROR**: Selectors matched 0 items
- **BLOCKED_BY_ROBOT**: Captcha or bot detection
- **UNKNOWN_ERROR**: Other failures

## Caching

Search results are cached per `(query, supplier_id)` for `CACHE_TTL_SECONDS` (default 600s / 10 minutes). Use the **Retest** action (future feature) to bypass cache.

## Rate Limiting

Backend enforces:
- **Max concurrent requests**: `MAX_CONCURRENT_REQUESTS` (default 3)
- **Delay between requests**: `REQUEST_DELAY_MS` (default 1000ms)

This ensures polite crawling and reduces blocking risk.

## Troubleshooting

### Backend fails to start

- Check `.env` file has valid Supabase credentials
- Ensure port 3001 is not in use

### Frontend can't connect to backend

- Verify backend is running on `http://localhost:3001`
- Check `NEXT_PUBLIC_API_URL` in `.env.local`

### No items found for a supplier

1. Use `/api/test-supplier` endpoint to debug
2. Check `debug_snapshot_url` to view raw HTML
3. Update CSS selectors in the database
4. Verify the store isn't blocking bots (check for captcha)

### Store returns BLOCKED_BY_ROBOT

- Switch to `mode: 'render'` in the supplier config
- Add Firecrawl API key to backend `.env`
- Consider using proxies (not implemented in MVP)

## Documentation

Complete documentation is available in the [docs/](docs/) folder:
- [Getting Started Guide](docs/COMO-USAR.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Firecrawl Setup](docs/FIRECRAWL_SETUP.md)
- [Testing Results](docs/TESTING_RESULTS.md)
- [Full Documentation Index](docs/README.md)

## Version Roadmap

### v1.0 (Current - POC)
- Multi-store search for public websites
- Configurable CSS selectors
- HTTP fetch + optional Firecrawl rendering
- Basic caching and rate limiting

### v2.0 (Planned)
- **Authentication support**: Login/session-based searches
- **User accounts**: Saved searches, favorites
- **Advanced filtering**: Price range, brand, rating
- **Price history**: Track changes over time
- **Alerts**: Notify when price drops
- **Admin UI**: Supplier management interface

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, Cheerio, Axios
- **Database**: Supabase (PostgreSQL + Storage)
- **Scraping**: Firecrawl (optional, for rendered pages)
- **Caching**: node-cache
- **Concurrency**: p-limit

## License

ISC

## Support

For issues or questions, please open a GitHub issue.

---

**Product Scout** - Built with Claude Code
