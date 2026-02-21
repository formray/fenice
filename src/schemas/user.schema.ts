import { z } from 'zod';

export const RoleEnum = z.enum(['superAdmin', 'admin', 'employee', 'client', 'vendor', 'user']);

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().min(2).max(50),
  fullName: z.string().min(1).max(100),
  role: RoleEnum.default('user'),
  active: z.boolean().default(true),
  emailVerified: z.boolean().default(false),
  pictureUrl: z.string().url().optional(),
  lastLoginDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UserCreateSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const UserUpdateSchema = z
  .object({
    fullName: z.string().min(1).max(100).optional(),
    pictureUrl: z.string().url().optional(),
  })
  .strict();

export const UserQuerySchema = z.object({
  search: z.string().optional(),
  role: RoleEnum.optional(),
  active: z.coerce.boolean().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
