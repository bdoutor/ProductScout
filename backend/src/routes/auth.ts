import { Router, Request, Response } from 'express';
import { setSession, clearSession, getSession } from '../utils/session';

const router = Router();

/**
 * POST /auth/login
 * Authenticate user and create session
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { user, pass } = req.body;

    // Validate credentials against environment variables
    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASS;

    if (!validUser || !validPass) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (user === validUser && pass === validPass) {
      setSession(res, user);
      return res.json({ ok: true, user });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Clear session and logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    clearSession(res);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const session = getSession(req);

    if (!session) {
      return res.status(401).json({ user: null });
    }

    return res.json({ user: session.u });
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(401).json({ user: null });
  }
});

export default router;
