import { z } from 'zod';
import { UserSchema } from './user.schema.js';

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const SignupSchema = z.object({
  email: z.email(),
  username: z.string().min(2).max(50),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const RequestPasswordResetSchema = z.object({
  email: z.email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type Login = z.infer<typeof LoginSchema>;
export type Signup = z.infer<typeof SignupSchema>;
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type VerifyEmail = z.infer<typeof VerifyEmailSchema>;
export type RequestPasswordReset = z.infer<typeof RequestPasswordResetSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
