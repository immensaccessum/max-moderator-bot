import type { NextFunction, Request, Response } from 'express';
import { config } from '../../config.js';
import { parseInitData } from '../auth/init-data.js';

function extractInitData(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('tma ')) {
    return header.slice(4).trim();
  }

  const direct = req.headers['x-max-init-data'];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const initData = extractInitData(req);
  if (initData) {
    const parsed = parseInitData(initData);
    if (!parsed?.user) {
      res.status(401).json({ error: 'Invalid init data' });
      return;
    }

    req.authUser = parsed.user;
    req.authMode = 'miniapp';
    next();
    return;
  }

  const token = config.web.adminToken;
  if (!token) {
    res.status(503).json({ error: 'Web admin auth is not configured' });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.slice(7) !== token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.authMode = 'token';
  next();
}
