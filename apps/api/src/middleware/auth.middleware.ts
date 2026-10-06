import type { RequestHandler } from 'express';
import type { Role } from '@repo/database';
import { prisma } from '@/lib/prisma.js';
import { verifyAccessToken } from '@/modules/auth/auth.tokens.js';
import { AppError } from '@/middleware/error-handler.js';

/**
 * Require a valid access token AND a currently active account.
 *
 * The user's status and role are read from the database on every request (a primary-key lookup),
 * so suspending, deleting or demoting a user takes effect immediately instead of when their
 * access token expires. Inactive accounts get a 401, which makes clients attempt a refresh;
 * the refresh is then rejected because the account's sessions were revoked, signing them out.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }

  let userId: string;

  try {
    userId = verifyAccessToken(authorization.slice('Bearer '.length)).sub;
  } catch {
    next(new AppError(401, 'INVALID_ACCESS_TOKEN', 'Invalid or expired access token'));
    return;
  }

  prisma.user
    .findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } })
    .then((user) => {
      if (!user || user.status !== 'ACTIVE') {
        next(new AppError(401, 'ACCOUNT_INACTIVE', 'This account is not active'));
        return;
      }

      req.user = { id: user.id, role: user.role };
      next();
    })
    .catch(next);
};

/**
 * Restrict a route to users with one of the given roles. Mount after requireAuth.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role as Role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}

/**
 * Read the authenticated user inside a handler mounted behind requireAuth.
 */
export function getAuthUser(req: Parameters<RequestHandler>[0]): { id: string; role: string } {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.user;
}
