import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { createApiRouter } from './routes/index.js';
import { requestLogMiddleware } from './middleware/request-log.js';

const log = createLogger('web');

function buildCorsOrigin(): cors.CorsOptions['origin'] {
  const origins = new Set<string>();
  if (config.web.publicUrl) {
    origins.add(config.web.publicUrl.replace(/\/$/, ''));
  }
  origins.add('https://max.ru');
  origins.add('https://web.max.ru');

  if (origins.size <= 2 && !config.web.publicUrl) {
    return true;
  }

  return (origin, callback) => {
    if (!origin || origins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

export function startWebServer(bot: Bot): Express | null {
  if (!config.web.enabled) {
    log.info('web admin disabled');
    return null;
  }

  if (!config.web.adminToken) {
    log.info('web admin auth mode', { mode: 'miniapp-only' });
  } else {
    log.info('web admin auth mode', { mode: 'token+miniapp' });
  }

  const app = express();
  const staticDir = path.join(process.cwd(), 'admin', 'public');

  app.set('trust proxy', 1);
  app.use(cors({ origin: buildCorsOrigin(), credentials: true }));
  app.use(express.json());
  app.use('/api/v1', requestLogMiddleware, createApiRouter(bot));
  app.use(
    express.static(staticDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    }),
  );

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error('web api error', { err });
    res.status(500).json({ error: 'Internal server error' });
  });

  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  app.listen(config.web.port, config.web.host, () => {
    const publicUrl = config.web.publicUrl ?? `http://${config.web.host}:${config.web.port}`;
    log.info('web admin listening', {
      publicUrl,
      host: config.web.host,
      port: config.web.port,
    });
  });

  return app;
}
