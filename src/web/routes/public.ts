import { Router } from 'express';
import { getPublicStatus } from '../services/public.js';

export function createPublicRouter(): Router {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json(getPublicStatus());
  });

  return router;
}
