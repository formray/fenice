import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { AuthService } from '../services/auth.service.js';
import {
  SignupSchema,
  LoginSchema,
  RefreshTokenSchema,
  AuthResponseSchema,
  AuthTokensSchema,
} from '../schemas/auth.schema.js';
import { ErrorResponseSchema } from '../schemas/common.schema.js';
import { loadEnv } from '../config/env.js';
import type { UserDocument } from '../models/user.model.js';
import type { AuthResponse, AuthTokens } from '../schemas/auth.schema.js';

// Lazy-init pattern: avoid running loadEnv() at import time (breaks tests)
let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    const env = loadEnv();
    authService = new AuthService(
      env.JWT_SECRET,
      env.JWT_REFRESH_SECRET,
      env.JWT_ACCESS_EXPIRY,
      env.JWT_REFRESH_EXPIRY
    );
  }
  return authService;
}

function serializeUser(user: UserDocument): AuthResponse['user'] {
  const json = user.toJSON() as Record<string, unknown>;
  return {
    id: json['id'] as string,
    email: json['email'] as string,
    username: json['username'] as string,
    fullName: json['fullName'] as string,
    role: json['role'] as AuthResponse['user']['role'],
    active: json['active'] as boolean,
    createdAt: String(json['createdAt']),
    updatedAt: String(json['updatedAt']),
  };
}

const signupRoute = createRoute({
  method: 'post',
  path: '/auth/signup',
  tags: ['Auth'],
  summary: 'Register a new user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SignupSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'User already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Authenticate a user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshTokenSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Tokens refreshed successfully',
      content: {
        'application/json': {
          schema: AuthTokensSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const authRouter = new OpenAPIHono();

authRouter.openapi(signupRoute, async (c) => {
  const body = c.req.valid('json');
  const service = getAuthService();
  const { user, tokens } = await service.signup(body);

  return c.json({ user: serializeUser(user), tokens }, 201);
});

authRouter.openapi(loginRoute, async (c) => {
  const body = c.req.valid('json');
  const service = getAuthService();
  const { user, tokens } = await service.login(body);

  return c.json({ user: serializeUser(user), tokens }, 200);
});

authRouter.openapi(refreshRoute, async (c) => {
  const body = c.req.valid('json');
  const service = getAuthService();
  const tokens = await service.refresh(body.refreshToken);

  return c.json(tokens, 200);
});
