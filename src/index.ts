import { OpenAPIHono } from '@hono/zod-openapi';
import { createNodeWebSocket } from '@hono/node-ws';
import { apiReference } from '@scalar/hono-api-reference';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { mcpRouter } from './routes/mcp.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { createWsRouter } from './routes/ws.routes.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authMiddleware } from './middleware/auth.js';
import { handleError } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { apiVersion } from './middleware/api-version.js';
import { generateLlmDocs } from './utils/llm-docs.js';

export const app = new OpenAPIHono();

const nodeWs = createNodeWebSocket({ app });

/** Re-export bound to avoid ESLint unbound-method with destructured method. */
export function injectWebSocket(...args: Parameters<typeof nodeWs.injectWebSocket>): void {
  nodeWs.injectWebSocket(...args);
}

// Global middleware
app.use('*', requestId);
app.use('*', requestLogger);

// API versioning
app.use('/api/*', apiVersion);

// Error handler
app.onError(handleError);

// Rate limiting — auth routes have stricter limits
app.use('/api/v1/auth/*', rateLimiter({ windowMs: 60_000, max: 10 }));
app.use('/api/v1/*', rateLimiter());

// Auth middleware — applied to protected routes only
app.use('/api/v1/users/*', authMiddleware);
app.use('/api/v1/upload/*', authMiddleware);
app.use('/api/v1/upload/*', rateLimiter({ windowMs: 60_000, max: 5 }));

// Mount API routes
app.route('/api/v1', healthRouter);
app.route('/api/v1', authRouter);
app.route('/api/v1', userRouter);
app.route('/api/v1', mcpRouter);
app.route('/api/v1', uploadRouter);
app.route('/api/v1', createWsRouter(nodeWs.upgradeWebSocket));

// --- Security scheme ---
app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// --- OpenAPI JSON spec ---
app.doc('/openapi', {
  openapi: '3.1.0',
  info: {
    title: 'FENICE API',
    version: '0.2.0',
    description:
      'AI-native, production-ready backend API — Formray Engineering Guidelines compliant',
  },
  servers: [{ url: 'http://localhost:3000' }],
});

// --- Scalar interactive docs ---
app.get(
  '/docs',
  apiReference({
    theme: 'kepler',
    url: '/openapi',
  })
);

// --- LLM-readable markdown docs ---
app.get('/docs/llm', (c) => {
  const spec = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'FENICE API',
      version: '0.2.0',
      description:
        'AI-native, production-ready backend API — Formray Engineering Guidelines compliant',
    },
  });
  const markdown = generateLlmDocs(spec as unknown as Record<string, unknown>);
  c.header('Content-Type', 'text/markdown');
  return c.text(markdown);
});

// Default export for server
export default app;
