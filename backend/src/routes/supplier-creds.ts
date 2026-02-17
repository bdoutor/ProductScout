import { Router, Request, Response } from 'express';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { requireAuth } from '../utils/session';

const router = Router();

// Apply authentication middleware to all routes in this file
router.use(requireAuth);

export interface SupplierCredential {
  id: string;
  name: string;
  login: string;
  password?: string; // plaintext only when creating/updating; not returned in GET
  url: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /admin/supplier-creds
 * List all supplier credentials
 */
router.get('/', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
  }
  try {
    const sb = supabase!;
    const { data, error } = await sb
      .from('supplier_credentials')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching supplier credentials:', error);
      return res.status(500).json({ error: error.message });
    }

    // Do not leak passwords; return only a flag
    const safe = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      login: row.login,
      url: row.url,
      notes: row.notes,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      has_password: Boolean(row.password)
    }));

    return res.json(safe);
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/supplier-creds
 * Create new supplier credential
 */
router.post('/', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
  }
  try {
    const { name, login, password, url, notes, active } = req.body;

    // Validation
    if (!name || !login || !password || !url) {
      return res.status(400).json({
        error: 'Missing required fields: name, login, password, url'
      });
    }

    const sb = supabase!;

    // Encrypt password before storing
    const { encryptPassword } = await import('../utils/secrets');
    const encrypted = encryptPassword(password);

    const { data, error } = await sb
      .from('supplier_credentials')
      .insert({
        name,
        login,
        password: encrypted,
        url,
        notes: notes || null,
        active: active !== undefined ? active : true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier credential:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      id: data.id,
      name: data.name,
      login: data.login,
      url: data.url,
      notes: data.notes,
      active: data.active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      has_password: true
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /admin/supplier-creds/:id
 * Update supplier credential
 */
router.put('/:id', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
  }
  try {
    const { id } = req.params;
    const { name, login, password, url, notes, active } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (login !== undefined) updateData.login = login;
    if (password !== undefined && password !== '') {
      const { encryptPassword } = await import('../utils/secrets');
      updateData.password = encryptPassword(password);
    }
    if (url !== undefined) updateData.url = url;
    if (notes !== undefined) updateData.notes = notes;
    if (active !== undefined) updateData.active = active;

    const sb = supabase!;
    const { data, error } = await sb
      .from('supplier_credentials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier credential:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Supplier credential not found' });
    }

    return res.json({
      id: data.id,
      name: data.name,
      login: data.login,
      url: data.url,
      notes: data.notes,
      active: data.active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      has_password: Boolean(data.password)
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/supplier-creds/:id
 * Delete supplier credential
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' });
  }
  try {
    const { id } = req.params;

    const sb = supabase!;
    const { error } = await sb
      .from('supplier_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting supplier credential:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
