import { Router } from 'express';

export function createSystemRouter(): Router {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      auth: req.authMode ?? 'unknown',
    });
  });

  router.get('/me', (req, res) => {
    if (!req.authUser) {
      res.json({ mode: req.authMode ?? 'token' });
      return;
    }

    const { id, first_name, last_name, username, photo_url } = req.authUser;
    res.json({
      mode: 'miniapp',
      user: {
        id,
        firstName: first_name,
        lastName: last_name,
        username,
        photoUrl: photo_url,
        displayName: [first_name, last_name].filter(Boolean).join(' ') || username || `ID ${id}`,
      },
    });
  });

  return router;
}
