import pino from 'pino';

// Read logging config straight from process.env so logging never depends on full env
// validation (e.g. in tests where Supabase / Anthropic keys aren't set).
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const logger = pino({
  level: LOG_LEVEL,
  ...(NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  redact: {
    paths: [
      '*.token',
      '*.api_key',
      '*.password',
      '*.authorization',
      'authorization',
      'headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});
