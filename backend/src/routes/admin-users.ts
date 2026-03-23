import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '../utils/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/admin/users
 * List all app users (password_hash never returned).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

    const { data, error } = await supabase
      .from('app_users')
      .select('id, login, role, active, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    logger.error('[admin-users] GET error: %s', (err as Error).message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users
 * Create a new user. Body: { login, password, role }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { login, password, role } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'login e password são obrigatórios' });
    if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'role inválido' });

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('app_users')
      .insert({ login, password_hash, role: role || 'user', active: true })
      .select('id, login, role, active, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Login já existe' });
      throw error;
    }
    return res.status(201).json(data);
  } catch (err) {
    logger.error('[admin-users] POST error: %s', (err as Error).message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update user. Body: { login?, password?, role?, active? }
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { login, password, role, active } = req.body;
    if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'role inválido' });

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (login !== undefined) updates.login = login;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;
    if (password) updates.password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select('id, login, role, active, created_at')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Utilizador não encontrado' });
    return res.json(data);
  } catch (err) {
    logger.error('[admin-users] PATCH error: %s', (err as Error).message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
