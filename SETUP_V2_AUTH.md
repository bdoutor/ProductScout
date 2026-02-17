# ProductScout v2.0 - Setup Guide (Authentication Edition)

This guide explains how to set up the ProductScout v2.0 with authentication and supplier credentials management.

## What's New in v2.0

- Admin authentication system with session management
- Supplier credentials management (CRUD interface)
- Protected admin area
- Support for automotive parts suppliers
- Login/logout functionality

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Access to Supabase SQL Editor

## Step-by-Step Setup

### 1. Database Setup

#### 1.1 Run Main Schema (if not already done)

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- File: supabase/schema.sql
```

Copy and paste the entire `supabase/schema.sql` file.

#### 1.2 Run V2 Migration (NEW)

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- File: supabase/migration_v2_supplier_credentials.sql
```

Copy and paste the entire `supabase/migration_v2_supplier_credentials.sql` file.

This creates:
- `supplier_credentials` table
- Seed data for 3 automotive suppliers (AUGER, GSMART, Martex)

### 2. Backend Setup

#### 2.1 Install Dependencies

```bash
cd backend
npm install
```

The following new packages are included:
- `express-session` - Session management
- `cookie-parser` - Cookie handling

#### 2.2 Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firecrawl (optional)
FIRECRAWL_API_KEY=your-firecrawl-key

# Cache & Rate Limiting
CACHE_TTL_SECONDS=600
MAX_CONCURRENT_REQUESTS=3
REQUEST_DELAY_MS=1000

# Authentication (NEW in v2.0)
ADMIN_USER=admin
ADMIN_PASS=admin
SESSION_SECRET=ProductScout2024SecretKey32Char
```

**IMPORTANT:** Change `SESSION_SECRET` to a random 32-character string in production!

### 3. Frontend Setup

#### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

#### 3.2 Configure Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

The `.env.local` should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

### 4. Start the Application

#### Option 1: Manual Start

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

#### Option 2: One-Click Start (if available)

Double-click `START-PRODUCTSCOUT.bat` in the project root.

### 5. Access the Application

1. **Login Page:** http://localhost:3000/login
   - Username: `admin`
   - Password: `admin`

2. **Admin Dashboard:** http://localhost:3000/admin (requires login)

3. **Main Search:** http://localhost:3000/ (public)

## New Features Overview

### Authentication System

**Routes:**
- `POST /auth/login` - Login with username/password
- `POST /auth/logout` - Logout and clear session
- `GET /auth/me` - Check current authentication status

**Session:**
- 8-hour session duration
- HttpOnly cookies (secure in production)
- Automatic redirect to login if not authenticated

### Supplier Credentials Management

**Routes (all protected):**
- `GET /admin/supplier-creds` - List all credentials
- `POST /admin/supplier-creds` - Create new credential
- `PUT /admin/supplier-creds/:id` - Update credential
- `DELETE /admin/supplier-creds/:id` - Delete credential

**Admin Interface:**
- Add/edit/delete supplier credentials
- View supplier login URLs
- Activate/deactivate suppliers
- Add notes for each supplier

## Default Suppliers

The system comes pre-configured with 3 automotive parts suppliers:

1. **AUGER**
   - Login: valdemar@eurocomponentes.pt
   - URL: https://portal.iamauger.com/login?return

2. **GSMART**
   - Login: valdemar craveiro
   - URL: https://eurocomp.gsmart.eu/usuarios/log

3. **Martex**
   - Login: EC01
   - URL: https://martex.pt

You can edit these credentials or add new suppliers via the admin interface.

## Security Considerations

### Current Implementation (MVP)

- Passwords stored in plaintext in database
- Simple session-based authentication
- Single admin user

### Production Recommendations

1. **Encrypt passwords** using bcrypt or Supabase Vault
2. **Use HTTPS** in production (set `secure: true` for cookies)
3. **Implement proper user management** with roles
4. **Add rate limiting** for login attempts
5. **Use environment-specific secrets**
6. **Enable CORS only for trusted domains**
7. **Add audit logging** for credential access

## Troubleshooting

### Cannot login

- Check backend is running on port 3001
- Verify `.env` has correct `ADMIN_USER` and `ADMIN_PASS`
- Check browser console for errors
- Ensure cookies are enabled

### 401 Unauthorized on admin pages

- Clear browser cookies
- Login again at `/login`
- Check backend logs for session errors

### Cannot save supplier credentials

- Verify Supabase credentials in backend `.env`
- Check migration was run successfully
- Look at backend console for database errors

## Next Steps

1. Update admin credentials (change default password)
2. Add your actual supplier credentials
3. Configure scraping selectors for each supplier
4. Test authentication flow with each supplier
5. (Future) Implement automated login to supplier portals

## File Structure

```
backend/
  src/
    routes/
      auth.ts                  # Authentication routes (NEW)
      supplier-creds.ts        # Supplier CRUD routes (NEW)
    utils/
      session.ts               # Session management (NEW)

frontend/
  src/
    app/
      login/
        page.tsx               # Login page (NEW)
      admin/
        layout.tsx             # Protected layout (NEW)
        page.tsx               # Admin dashboard (NEW)

supabase/
  migration_v2_supplier_credentials.sql  # V2 migration (NEW)
```

## Support

For issues or questions, create a GitHub issue or check the troubleshooting section.

---

**ProductScout v2.0** - Automotive Parts Edition with Authentication
Built with Claude Code
