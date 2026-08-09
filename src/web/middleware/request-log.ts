import type { NextFunction, Request, Response } from 'express';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('web');

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (req.path === '/health') {
      return;
    }

    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    log[level]('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      auth: req.authMode ?? 'none',
      userId: req.authUser?.id,
    });
  });

  next();
}
