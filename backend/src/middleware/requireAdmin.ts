import { Request, Response, NextFunction } from 'express';
import { getSession } from '../utils/session';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if ((session.role || 'admin') !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
