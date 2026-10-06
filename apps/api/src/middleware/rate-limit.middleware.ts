import { rateLimit, type Options } from 'express-rate-limit';
import { env } from '@config/env.js';

const shared: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Tests exercise many auth requests from one IP; limits are covered by express-rate-limit itself.
  skip: () => env.NODE_ENV === 'test',
};

function limitMessage(message: string) {
  return { error: { code: 'RATE_LIMITED', message } };
}

export const globalRateLimiter = rateLimit({
  ...shared,
  // The admin API has its own limit (below): all admin traffic arrives from the admin panel's server.
  skip: (req) => env.NODE_ENV === 'test' || req.path.startsWith('/api/v1/admin'),
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  message: limitMessage('Too many requests. Please try again later.'),
});

/**
 * Brute-force protection for endpoints that accept credentials or one-time tokens. Not applied to
 * /me, /refresh or /logout: those need a valid token already and are called on every app open.
 */
export const authRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: limitMessage('Too many authentication requests. Please try again later.'),
});

export const passwordResetRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: limitMessage('Too many password reset requests. Please try again later.'),
});

/** Admin API: authenticated and role-gated, but one admin page load makes several calls. */
export const adminRateLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 600,
  message: limitMessage('Too many admin requests. Please slow down.'),
});
