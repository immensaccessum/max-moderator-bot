import type { MaxWebAppUser } from '../web/auth/init-data.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: MaxWebAppUser;
      authMode?: 'miniapp' | 'token';
    }
  }
}

export {};
