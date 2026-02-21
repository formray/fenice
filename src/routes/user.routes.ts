import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { UserService } from '../services/user.service.js';
import { UserSchema, UserUpdateSchema, UserQuerySchema } from '../schemas/user.schema.js';
import {
  CursorPaginationSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
} from '../schemas/common.schema.js';
import type { User } from '../schemas/user.schema.js';
import type { UserDocument } from '../models/user.model.js';
import { requireRole } from '../middleware/rbac.js';
import { buildUserFilter } from '../utils/query-builder.js';

// Env type for routes that expect auth context
type AuthEnv = {
  Variables: {
    userId: string;
    email: string;
    role: string;
    requestId: string;
  };
};

const userService = new UserService();

function serializeUser(user: UserDocument): User {
  const json = user.toJSON() as Record<string, unknown>;
  return {
    id: json['id'] as string,
    email: json['email'] as string,
    username: json['username'] as string,
    fullName: json['fullName'] as string,
    role: json['role'] as User['role'],
    active: json['active'] as boolean,
    emailVerified: json['emailVerified'] === true,
    createdAt: String(json['createdAt']),
    updatedAt: String(json['updatedAt']),
  };
}

// --- Route definitions ---

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'List users with pagination and filtering',
  security: [{ Bearer: [] }],
  request: {
    query: CursorPaginationSchema.extend(UserQuerySchema.shape),
  },
  responses: {
    200: {
      description: 'Paginated user list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(UserSchema),
            pagination: z.object({
              hasNext: z.boolean(),
              nextCursor: z.string().nullable(),
            }),
          }),
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

const getMeRoute = createRoute({
  method: 'get',
  path: '/users/me',
  tags: ['Users'],
  summary: 'Get current authenticated user',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Current user',
      content: {
        'application/json': {
          schema: UserSchema,
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

const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'User found',
      content: {
        'application/json': {
          schema: UserSchema,
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
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const updateUserRoute = createRoute({
  method: 'patch',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Update user by ID',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: UserUpdateSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'User updated',
      content: {
        'application/json': {
          schema: UserSchema,
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
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Delete user by ID (admin only)',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'User deleted',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
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
    403: {
      description: 'Forbidden — admin only',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// --- Router ---

export const userRouter = new OpenAPIHono<AuthEnv>();

// NOTE: Auth middleware is applied in src/index.ts via app.use('/api/v1/users/*', authMiddleware)

// RBAC: admin-only for delete operations
userRouter.delete('/users/:id', requireRole('admin'));

userRouter.openapi(listUsersRoute, async (c) => {
  const { cursor, limit, sort, order, ...filterParams } = c.req.valid('query');
  const filter = buildUserFilter(filterParams);
  const result = await userService.findAll(filter, { cursor, limit, sort, order });
  return c.json(
    {
      data: result.data.map(serializeUser),
      pagination: result.pagination,
    },
    200
  );
});

userRouter.openapi(getMeRoute, async (c) => {
  const userId = c.get('userId');
  const user = await userService.findById(userId);
  return c.json(serializeUser(user), 200);
});

userRouter.openapi(getUserRoute, async (c) => {
  const { id } = c.req.valid('param');
  const user = await userService.findById(id);
  return c.json(serializeUser(user), 200);
});

userRouter.openapi(updateUserRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const user = await userService.update(id, body);
  return c.json(serializeUser(user), 200);
});

userRouter.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.valid('param');
  await userService.delete(id);
  return c.json({ success: true as const, message: 'User deleted' }, 200);
});
