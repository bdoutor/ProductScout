# ProductScout AI Assistant Instructions

## Project Overview
ProductScout is a multi-supplier automotive parts search platform built with Next.js (frontend) and Node.js/Express (backend). It aggregates product data from multiple suppliers, supporting both public and authenticated supplier portals.

## Key Architecture Patterns

### Authentication Flow
- Session-based auth using HTTP-only cookies
- Auth check in frontend (`app/page.tsx`) redirects to `/login` if unauthenticated
- Credential management for supplier portals in backend (`backend/src/utils/secrets.ts`)

### Data Flow
1. Frontend sends search query to backend API
2. Backend parallelly queries multiple suppliers via configurable providers
3. Results are normalized, aggregated, and sorted by availability/price
4. Real-time updates streamed to frontend during search

### Provider System
- Provider interface in `backend/src/providers/types.ts`
- Two fetch modes:
  - HTTP mode: Direct requests for static sites
  - Render mode: Uses Firecrawl API for JavaScript-heavy sites
- Provider selection based on supplier configuration (`supports()` method)

## Development Workflow

### Starting the Application
```bash
# Recommended: One-click start
START-PRODUCTSCOUT.bat  # Starts both frontend and backend

# Alternative: Manual start
start-dev.bat  # Legacy startup script
```

### Key URLs
- Frontend: http://localhost:3000
- Admin Panel: http://localhost:3000/admin
- Backend API: http://localhost:3001

### Common Tasks
- Adding new supplier: Configure in Supabase database (no code changes needed)
- Debugging supplier issues: Check `backend-current.log` for detailed diagnostics
- Testing supplier auth: Use `test-firecrawl.bat` for render mode validation

## Project-Specific Patterns

### Error Handling
- Per-supplier error isolation prevents total search failure
- Explicit error types in `backend/src/types/index.ts`
- Frontend shows supplier-specific error states in results table

### Performance Optimizations
- In-memory caching with 5-15 minute TTL
- Parallel supplier queries
- Results streaming for better UX
- Smart sorting prioritizes available items

## Integration Points
- Supabase: Database and storage (supplier configs, credentials)
- Firecrawl API: Used for JavaScript-heavy supplier sites
- External supplier portals: Both public and authenticated

## Development Guidelines
1. Always test both HTTP and render modes when modifying scraper logic
2. Use typescript strict mode and maintain type definitions
3. Follow existing error handling patterns for supplier integration
4. Update supplier schemas in database rather than hardcoding

## Key Files to Review
- `backend/src/services/scraper.ts`: Core scraping logic
- `backend/src/providers/types.ts`: Provider interface definitions
- `frontend/src/app/page.tsx`: Main search interface
- `backend/src/utils/parser.ts`: HTML parsing utilities