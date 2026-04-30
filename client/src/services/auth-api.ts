/**
 * Thin client for FENICE's /api/v1/auth/* endpoints.
 * Returns raw responses; the auth store handles state and persistence.
 */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
  emailVerified: boolean;
  pictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

interface ApiError {
  error?: { code?: string; message?: string };
  message?: string;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    return body.error?.message ?? body.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthResponse;
}

export async function signup(input: {
  email: string;
  username: string;
  fullName: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthResponse;
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthTokens;
}

export async function logout(accessToken: string): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Best-effort — even if it fails (network, expired), the local state is cleared
}

export async function fetchMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch('/api/v1/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return (await res.json()) as AuthUser;
}

/** Decodes a JWT exp claim. Returns null on malformed tokens. */
export function tokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64url = parts[1] ?? '';
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp === null || Date.now() >= exp;
}
