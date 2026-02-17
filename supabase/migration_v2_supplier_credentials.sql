-- ============================================================================
-- MIGRATION V2: SUPPLIER CREDENTIALS TABLE
-- ============================================================================
-- This migration adds support for authenticated supplier portals
-- Run this AFTER the main schema.sql

-- ============================================================================
-- SUPPLIER_CREDENTIALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  name TEXT UNIQUE NOT NULL,
  login TEXT NOT NULL,
  password TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Optional fields for future expansion
  notes TEXT,
  active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_credentials_name ON supplier_credentials(name);
CREATE INDEX IF NOT EXISTS idx_supplier_credentials_active ON supplier_credentials(active);

-- Update trigger
CREATE TRIGGER update_supplier_credentials_updated_at
  BEFORE UPDATE ON supplier_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Automotive Parts Suppliers
-- ============================================================================

-- AUGER
INSERT INTO public.supplier_credentials (name, login, password, url, notes)
VALUES (
  'AUGER',
  'valdemar@eurocomponentes.pt',
  'Euro1999*',
  'https://portal.iamauger.com/login?return',
  'Portal AUGER - Automotive parts supplier'
) ON CONFLICT (name) DO UPDATE SET
  login = EXCLUDED.login,
  password = EXCLUDED.password,
  url = EXCLUDED.url,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- GSMART
INSERT INTO public.supplier_credentials (name, login, password, url, notes)
VALUES (
  'GSMART',
  'valdemar craveiro',
  'Euro1999',
  'https://eurocomp.gsmart.eu/usuarios/log',
  'Portal GSMART - Automotive parts supplier'
) ON CONFLICT (name) DO UPDATE SET
  login = EXCLUDED.login,
  password = EXCLUDED.password,
  url = EXCLUDED.url,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Martex
INSERT INTO public.supplier_credentials (name, login, password, url, notes)
VALUES (
  'Martex',
  'EC01',
  'martex1234',
  'https://martex.pt',
  'Portal Martex - Automotive parts supplier'
) ON CONFLICT (name) DO UPDATE SET
  login = EXCLUDED.login,
  password = EXCLUDED.password,
  url = EXCLUDED.url,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- ============================================================================
-- NOTES
-- ============================================================================
-- WARNING: This table stores plaintext passwords for MVP purposes.
-- For production, consider:
-- 1. Using Supabase Vault for encrypted secrets
-- 2. Implementing proper encryption at application level
-- 3. Using environment variables or secret management services
--
-- To run this migration:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run"
