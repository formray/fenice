import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import { NotAuthorizedError } from '../utils/errors.js';
import { loadEnv } from '../config/env.js';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Lazy-init: avoid running loadEnv() at import time (breaks tests)
let jwtSecret: string | null = null;

function getJwtSecret(): string {
  if (!jwtSecret) {
    const env = loadEnv();
    jwtSecret = env.JWT_SECRET;
  }
  return jwtSecret;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authorization = c.req.header('authorization');

  if (!authorization) {
    throw new NotAuthorizedError('Missing authorization header');
  }

  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new NotAuthorizedError('Invalid authorization format');
  }

  const token = parts[1] ?? '';

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;

    c.set('userId', payload.userId);
    c.set('email', payload.email);
    c.set('role', payload.role);

    await next();
  } catch {
    throw new NotAuthorizedError('Invalid or expired token');
  }
});
