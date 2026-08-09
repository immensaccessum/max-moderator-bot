import { startApp } from './app.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('app');

startApp().catch((err) => {
  log.error('failed to start', { err });
  process.exit(1);
});
