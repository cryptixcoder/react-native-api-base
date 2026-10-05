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
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  message: limitMessage('Too many requests. Please try again later.'),
});

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
