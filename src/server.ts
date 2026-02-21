import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { app, injectWebSocket } from './index.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';

dotenv.config();

const env = loadEnv();
const logger = createLogger(env.SERVICE_NAME, env.LOG_LEVEL);

async function start(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const server = serve(
      {
        fetch: app.fetch,
        port: env.PORT,
        hostname: env.HOST,
      },
      (info) => {
        logger.info(`FENICE is running on http://${env.HOST}:${info.port}`);
      }
    );

    injectWebSocket(server);
    logger.info('WebSocket support enabled');
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

void start();
