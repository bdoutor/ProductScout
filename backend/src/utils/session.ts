import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const COOKIE_NAME = 'ps_session';
const DEFAULT_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_MAX_AGE_MS = parseInt(process.env.SESSION_MAX_AGE_MS || `${DEFAULT_MAX_AGE_MS}`, 10);
let fallbackSessionSecret: string | null = null;

export interface SessionData {
  u: string;    // username
  t: number;    // timestamp
  role: string; // 'admin' | 'user'
}

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) {
    return process.env.SESSION_SECRET.trim();
  }

  if (!fallbackSessionSecret) {
    fallbackSessionSecret = randomBytes(32).toString('hex');
    console.warn('[session] SESSION_SECRET not configured. Using an ephemeral in-memory secret.');
  }

  return fallbackSessionSecret;
}

/**
 * Set session cookie
 */
export function setSession(res: Response, user: string, role: string = 'admin'): void {
  const sessionData: SessionData = {
    u: user,
    t: Date.now(),
    role,
  };

  res.cookie(COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: SESSION_MAX_AGE_MS,
    signed: true
  });
}

/**
 * Clear session cookie
 */
export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Get session data from cookie
 */
export function getSession(req: Request): SessionData | null {
  const raw = (req as any).signedCookies?.[COOKIE_NAME] || req.cookies?.[COOKIE_NAME];
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as SessionData;
    // Expire session based on timestamp
    if (Date.now() - data.t > SESSION_MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Middleware: Require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Attach user to request for downstream use
  (req as any).user = session.u;
  next();
}
