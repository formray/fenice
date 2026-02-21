import pino from 'pino';

export function createLogger(serviceName: string, logLevel: string): pino.Logger {
  return pino({
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: serviceName,
    },
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}
