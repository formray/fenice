import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../utils/errors.js';

export interface RateLimitStore {
  increment(key: string): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly windowMs: number) {
    // Cleanup expired entries every 60s
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60_000);
    // Don't block process exit
    this.cleanupTimer.unref();
  }

  async increment(key: string): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now >= existing.resetAt) {
      const entry = { count: 1, resetAt: now + this.windowMs };
      this.store.set(key, entry);
      return entry;
    }

    existing.count += 1;
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.store.clear();
  }
}

interface RateLimiterOptions {
  windowMs?: number | undefined;
  max?: number | undefined;
  store?: RateLimitStore | undefined;
  keyGenerator?:
    | ((c: {
        req: { header: (name: string) => string | undefined };
        get: (key: string) => unknown;
      }) => string)
    | undefined;
}

export function rateLimiter(options: RateLimiterOptions = {}): MiddlewareHandler {
  const {
    windowMs = 60_000,
    max = 100,
    keyGenerator = (c): string => {
      const userId = c.get('userId') as string | undefined;
      return userId ?? c.req.header('x-forwarded-for') ?? 'unknown';
    },
  } = options;

  const store = options.store ?? new MemoryRateLimitStore(windowMs);

  return createMiddleware(async (c, next) => {
    const key = keyGenerator(c);
    const { count, resetAt } = await store.increment(key);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      throw new RateLimitError(retryAfter);
    }

    await next();
  });
}
