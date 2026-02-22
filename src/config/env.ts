import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3000),

  // Database
  MONGODB_URI: z.url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SERVICE_NAME: z.string().default('fenice'),

  // Optional — Adapters (only required in production)
  RESEND_API_KEY: z.string().optional(),
  GCS_BUCKET_NAME: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS
  CLIENT_URL: z.url().optional(),

  // Upload
  UPLOAD_MAX_SIZE_BYTES: z.coerce.number().default(104_857_600),
  UPLOAD_CHUNK_SIZE_BYTES: z.coerce.number().default(5_242_880),
  UPLOAD_SESSION_TIMEOUT_MS: z.coerce.number().default(3_600_000),
  UPLOAD_MAX_CONCURRENT: z.coerce.number().default(3),

  // WebSocket
  WS_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30_000),
  WS_HEARTBEAT_TIMEOUT_MS: z.coerce.number().default(10_000),
  WS_MESSAGE_RATE_LIMIT: z.coerce.number().default(60),

  // Account Lockout
  LOCKOUT_THRESHOLD: z.coerce.number().default(5),
  LOCKOUT_DURATION_MS: z.coerce.number().default(900_000), // 15 minutes

  // Request Timeout
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),

  // Body Size Limit
  BODY_SIZE_LIMIT_BYTES: z.coerce.number().default(1_048_576), // 1MB

  // World WS
  WORLD_WS_BUFFER_SIZE: z.coerce.number().default(1000),
  WORLD_WS_RESUME_TTL_MS: z.coerce.number().default(300_000), // 5 minutes

  // Delta Producer
  DELTA_METRICS_INTERVAL_MS: z.coerce.number().default(5_000),
  DELTA_DIFF_INTERVAL_MS: z.coerce.number().default(30_000),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = z.treeifyError(result.error);
    console.error('Invalid environment variables:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
}
