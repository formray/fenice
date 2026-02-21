import pino from 'pino';

export function createLogger(serviceName: string, logLevel: string): pino.Logger {
  const options: pino.LoggerOptions = {
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: serviceName,
    },
  };

  if (process.env.NODE_ENV === 'development') {
    options.transport = { target: 'pino-pretty', options: { colorize: true } };
  }

  return pino(options);
}
