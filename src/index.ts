import { OpenAPIHono } from '@hono/zod-openapi';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';

export const app = new OpenAPIHono();

// Mount API routes
app.route('/api/v1', healthRouter);
app.route('/api/v1', authRouter);

// Default export for server
export default app;
