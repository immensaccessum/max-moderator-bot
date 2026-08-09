type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return 'info';
}

const configuredLevel = parseLogLevel(process.env.LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[configuredLevel];
}

function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (value instanceof Error) {
      parts.push(`${key}=${value.message}`);
      continue;
    }
    if (typeof value === 'object') {
      try {
        parts.push(`${key}=${JSON.stringify(value)}`);
      } catch {
        parts.push(`${key}=[object]`);
      }
      continue;
    }
    parts.push(`${key}=${String(value)}`);
  }

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function write(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${level.toUpperCase().padEnd(5)} [${module}] ${message}${formatContext(context)}`;

  if (level === 'error') {
    console.error(line);
    const err = context?.err;
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
};

export function createLogger(module: string): Logger {
  return {
    debug: (message, context) => write('debug', module, message, context),
    info: (message, context) => write('info', module, message, context),
    warn: (message, context) => write('warn', module, message, context),
    error: (message, context) => write('error', module, message, context),
  };
}
