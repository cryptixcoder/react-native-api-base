import type { RequestHandler } from 'express';
import { verifyAccessToken } from '@/modules/auth/auth.tokens.js';
import { AppError } from '@/middleware/error-handler.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const payload = verifyAccessToken(authorization.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'INVALID_ACCESS_TOKEN', 'Invalid or expired access token'));
  }
};

/**
 * Read the authenticated user inside a handler mounted behind requireAuth.
 */
export function getAuthUser(req: Parameters<RequestHandler>[0]): { id: string; role: string } {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.user;
}
