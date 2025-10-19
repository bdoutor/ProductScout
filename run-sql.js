const https = require('https');

const SUPABASE_URL = 'https://zssuffmrgchloymtgmlo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzc3VmZm1yZ2NobG95bXRnbWxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc0NjM4MiwiZXhwIjoyMDc2MzIyMzgyfQ.yeMIX65kyt_D-klgS4bt_WX6TzH3MtrnP-7AHKkGrzs';

const SQL = `-- Product Scout Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  enabled BOOLEAN DEFAULT true,
  name TEXT UNIQUE NOT NULL,
  base_url TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('http', 'render')),
  search_url_template TEXT NOT NULL,

  selectors JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeouts JSONB DEFAULT NULL,

  CONSTRAINT valid_selectors CHECK (
    selectors ? 'result_selectors' AND
    selectors->'result_selectors' ? 'item' AND
    selectors->'result_selectors' ? 'name' AND
    selectors->'result_selectors' ? 'price' AND
    selectors->'result_selectors' ? 'link'
  )
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_enabled ON suppliers(enabled);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ============================================================================
-- SEARCH_RUNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  reference TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  step_failed TEXT CHECK (step_failed IN ('search', 'extract') OR step_failed IS NULL),

  error_message TEXT,
  error_details TEXT,

  engine TEXT NOT NULL CHECK (engine IN ('http', 'render')),
  search_url_effective TEXT NOT NULL,
  http_status_search INTEGER,

  durations JSONB DEFAULT '{}'::jsonb,
  selector_counts JSONB DEFAULT '{}'::jsonb,

  debug_snapshot_url TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_search_runs_supplier ON search_runs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_search_runs_reference ON search_runs(reference);
CREATE INDEX IF NOT EXISTS idx_search_runs_created ON search_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_runs_status ON search_runs(status);

-- ============================================================================
-- SEARCH_HISTORY TABLE (optional, for UI stats)
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  query TEXT NOT NULL,
  total_items INTEGER DEFAULT 0,
  available_items INTEGER DEFAULT 0,
  suppliers_searched INTEGER DEFAULT 0,
  suppliers_errored INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);

-- ============================================================================
-- SAMPLE DATA: Insert example suppliers
-- ============================================================================

-- FNAC Portugal
INSERT INTO suppliers (name, base_url, mode, search_url_template, enabled, selectors)
VALUES (
  'FNAC',
  'https://www.fnac.pt',
  'http',
  'https://www.fnac.pt/SearchResult/ResultList.aspx?Search={query}',
  true,
  '{
    "result_selectors": {
      "item": ".Article-item",
      "name": ".Article-title",
      "code": ".Article-code",
      "price": ".Article-price",
      "availability": ".Article-availability",
      "delivery": ".Article-delivery",
      "link": "a.Article-titleLink"
    }
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Rádio Popular
INSERT INTO suppliers (name, base_url, mode, search_url_template, enabled, selectors)
VALUES (
  'Rádio Popular',
  'https://www.radiopopular.pt',
  'http',
  'https://www.radiopopular.pt/pesquisa?q={query}',
  true,
  '{
    "result_selectors": {
      "item": ".product-item",
      "name": ".product-name",
      "code": ".product-sku",
      "price": ".product-price",
      "availability": ".stock-info",
      "link": "a.product-link"
    }
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Continente
INSERT INTO suppliers (name, base_url, mode, search_url_template, enabled, selectors)
VALUES (
  'Continente',
  'https://www.continente.pt',
  'http',
  'https://www.continente.pt/pesquisa/?q={query}',
  true,
  '{
    "result_selectors": {
      "item": ".product",
      "name": ".product-title",
      "price": ".product-price-value",
      "availability": ".product-stock",
      "link": "a.product-link"
    }
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- Lidl
INSERT INTO suppliers (name, base_url, mode, search_url_template, enabled, selectors)
VALUES (
  'Lidl',
  'https://www.lidl.pt',
  'http',
  'https://www.lidl.pt/q/pesquisa?q={query}',
  false,
  '{
    "result_selectors": {
      "item": ".product-grid-item",
      "name": ".product-name",
      "price": ".price",
      "link": "a.product-link"
    }
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();`;

const postData = JSON.stringify({ query: SQL });

const options = {
  hostname: 'zssuffmrgchloymtgmlo.supabase.co',
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
  }
};

// Try using the SQL endpoint directly
const sqlOptions = {
  hostname: 'zssuffmrgchloymtgmlo.supabase.co',
  port: 443,
  path: '/rest/v1/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer': 'return=representation'
  }
};

console.log('Executando SQL no Supabase...\n');

// We'll execute each statement separately via direct SQL
const statements = SQL.split(';').filter(s => s.trim().length > 0);

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'zssuffmrgchloymtgmlo.supabase.co',
      port: 443,
      path: '/rest/v1/rpc',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data });
        } else {
          reject({ success: false, status: res.statusCode, data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

console.log('✓ SQL preparado para execução');
console.log('✓ Total de statements:', statements.length);
console.log('\nNOTA: A API REST do Supabase não suporta execução direta de SQL DDL.');
console.log('Por favor, execute o SQL manualmente no SQL Editor do Supabase Dashboard.\n');
console.log('Instruções:');
console.log('1. Vá a: https://supabase.com/dashboard/project/zssuffmrgchloymtgmlo/sql');
console.log('2. Clique em "New Query"');
console.log('3. Cole o conteúdo do ficheiro supabase/schema.sql');
console.log('4. Clique em "Run"');
