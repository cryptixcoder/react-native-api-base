import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { env } from '@config/env.js';
import { generateSecureToken, hashToken } from '@/utils/crypto.js';

const ISSUER = 'myapp-api';
const AUDIENCE = 'myapp-mobile';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
  type: 'access';
}

export function createAccessToken(params: { userId: string; role: string }): string {
  const payload = {
    role: params.role,
    type: 'access',
  } satisfies Omit<AccessTokenPayload, 'sub'>;

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    subject: params.userId,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  });

  if (typeof payload !== 'object' || payload === null || payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }

  return payload as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random values, not JWTs.
 * Only the hash is stored, which makes revocation and rotation straightforward.
 */
export function createRefreshToken(): { rawToken: string; tokenHash: string } {
  const rawToken = generateSecureToken();

  return {
    rawToken,
    tokenHash: hashToken(rawToken),
  };
}
