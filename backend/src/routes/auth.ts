import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { setSession, clearSession, getSession } from '../utils/session';
import { getSupabaseClient } from '../utils/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /auth/login
 * Authenticate user against app_users table in Supabase.
 * Falls back to .env ADMIN_USER/ADMIN_PASS if Supabase lookup fails (safety net).
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { user, pass } = req.body;
    if (!user || !pass) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const supabase = getSupabaseClient();

    // Try Supabase app_users first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('id, login, password_hash, role, active')
          .eq('login', user)
          .single();

        if (!error && data) {
          if (!data.active) {
            return res.status(401).json({ error: 'Conta desactivada' });
          }
          const match = await bcrypt.compare(pass, data.password_hash);
          if (match) {
            setSession(res, data.login, data.role);
            return res.json({ ok: true, user: data.login, role: data.role });
          }
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }
      } catch (err) {
        logger.warn('[auth] Supabase app_users lookup failed, trying env fallback: %s', (err as Error).message);
      }
    }

    // Fallback: .env credentials (always admin role)
    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASS;
    if (validUser && validPass && user === validUser && pass === validPass) {
      setSession(res, user, 'admin');
      return res.json({ ok: true, user, role: 'admin' });
    }

    return res.status(401).json({ error: 'Credenciais inválidas' });
  } catch (error) {
    logger.error('[auth] Login error: %s', (error as Error).message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    clearSession(res);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Returns current user and role.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ user: null, role: null });
    }
    return res.json({ user: session.u, role: session.role || 'admin' });
  } catch (error) {
    return res.status(401).json({ user: null, role: null });
  }
});

export default router;
