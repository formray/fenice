import jwt from 'jsonwebtoken';

export interface WsAuthPayload {
  userId: string;
  email: string;
  role: string;
}

export function verifyWsToken(token: string, secret: string): WsAuthPayload | null {
  try {
    const payload = jwt.verify(token, secret) as Record<string, unknown>;
    if (
      typeof payload['userId'] !== 'string' ||
      typeof payload['email'] !== 'string' ||
      typeof payload['role'] !== 'string'
    ) {
      return null;
    }
    return {
      userId: payload['userId'],
      email: payload['email'],
      role: payload['role'],
    };
  } catch {
    return null;
  }
}
