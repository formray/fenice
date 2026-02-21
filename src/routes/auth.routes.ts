import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { AuthService } from '../services/auth.service.js';
import {
  SignupSchema,
  LoginSchema,
  RefreshTokenSchema,
  AuthResponseSchema,
  AuthTokensSchema,
  VerifyEmailSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
} from '../schemas/auth.schema.js';
import { ErrorResponseSchema, SuccessResponseSchema } from '../schemas/common.schema.js';
import { loadEnv } from '../config/env.js';
import { createAdapters } from '../adapters/index.js';
import type { UserDocument } from '../models/user.model.js';
import type { AuthResponse } from '../schemas/auth.schema.js';

// Lazy-init pattern: avoid running loadEnv() at import time (breaks tests)
let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    const env = loadEnv();
    const adapters = createAdapters();
    authService = new AuthService(
      env.JWT_SECRET,
      env.JWT_REFRESH_SECRET,
      env.JWT_ACCESS_EXPIRY,
      env.JWT_REFRESH_EXPIRY,
      adapters.email,
      env.CLIENT_URL
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
    emailVerified: json['emailVerified'] === true,
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

const verifyEmailRoute = createRoute({
  method: 'get',
  path: '/auth/verify-email',
  tags: ['Auth'],
  summary: 'Verify email address with token',
  request: {
    query: VerifyEmailSchema,
  },
  responses: {
    200: {
      description: 'Email verified successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid or expired token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const resendVerificationRoute = createRoute({
  method: 'post',
  path: '/auth/resend-verification',
  tags: ['Auth'],
  summary: 'Resend email verification (requires auth)',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Verification email sent',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Email already verified',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const requestPasswordResetRoute = createRoute({
  method: 'post',
  path: '/auth/request-password-reset',
  tags: ['Auth'],
  summary: 'Request a password reset email',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RequestPasswordResetSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'If account exists, a reset email was sent',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
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
  },
});

const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/auth/reset-password',
  tags: ['Auth'],
  summary: 'Reset password with token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ResetPasswordSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Password reset successful',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
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
      description: 'Invalid or expired token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

type AuthEnv = {
  Variables: {
    userId: string;
    email: string;
    role: string;
    requestId: string;
  };
};

export const authRouter = new OpenAPIHono<AuthEnv>();

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

authRouter.openapi(verifyEmailRoute, async (c) => {
  const { token } = c.req.valid('query');
  const service = getAuthService();
  await service.verifyEmail(token);

  return c.json({ success: true as const, message: 'Email verified successfully' }, 200);
});

authRouter.openapi(resendVerificationRoute, async (c) => {
  const userId = c.get('userId');
  const service = getAuthService();
  await service.resendVerification(userId);

  return c.json({ success: true as const, message: 'Verification email sent' }, 200);
});

authRouter.openapi(requestPasswordResetRoute, async (c) => {
  const { email } = c.req.valid('json');
  const service = getAuthService();
  await service.requestPasswordReset(email);

  return c.json(
    { success: true as const, message: 'If the account exists, a reset email was sent' },
    200
  );
});

authRouter.openapi(resetPasswordRoute, async (c) => {
  const { token, newPassword } = c.req.valid('json');
  const service = getAuthService();
  await service.resetPassword(token, newPassword);

  return c.json({ success: true as const, message: 'Password reset successful' }, 200);
});
