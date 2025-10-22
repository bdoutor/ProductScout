import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env first
dotenv.config();

// If SUPABASE vars aren't present, try loading backend/.env.backup for local dev
const needFallback = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
if (needFallback) {
  try {
    const backupPath = path.resolve(__dirname, '..', '..', '.env.backup');
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf8');
      const parsed = content.split(/\r?\n/).filter(Boolean).map(line => line.split('=')).reduce((acc: any, parts: string[]) => {
        const k = parts.shift();
        if (!k) return acc;
        acc[k] = parts.join('=');
        return acc;
      }, {});
      if (parsed.SUPABASE_URL && parsed.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_URL = process.env.SUPABASE_URL || parsed.SUPABASE_URL;
        process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY;
      }
      // Also support legacy ANON key
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY && parsed.SUPABASE_ANON_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = parsed.SUPABASE_ANON_KEY;
      }
    }
  } catch (e) {
    // ignore fallback errors
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export async function trySupabasePing(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    // Lightweight query: may fail if schema not applied, report error instead of throwing
    const { error } = await supabase.from('suppliers').select('id').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}
