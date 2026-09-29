import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { env } from '@config/env.js';
import { generateSecureToken, hashToken } from '@/utils/crypto.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
  type: 'access';
}

export function createAccessToken(params: { userId: string; role: string }): string {
  const payload: AccessTokenPayload = {
    sub: params.userId,
    role: params.role,
    type: 'access',
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'myapp-api',
    audience: 'myapp-mobile',
  });
}

export function verififyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'myapp-api',
    audience: 'myapp-mobile',
  });

  if (typeof payload !== 'object' || payload === null || payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }

  return payload as AccessTokenPayload;
}

export function createRefreshToken(): { rawToken: string; hash: string } {
  const rawToken = generateSecureToken();

  return {
    rawToken,
    hash: hashToken(rawToken),
  };
}
