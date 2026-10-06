import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { corsOrigins, env } from '@config/env.js';
import { logger } from '@/lib/logger.js';
import { errorHandler } from '@/middleware/error-handler.js';
import { notFound } from '@/middleware/not-found.js';
import { adminRateLimiter, globalRateLimiter } from '@/middleware/rate-limit.middleware.js';
import { requestId } from '@/middleware/request-id.js';
import { adminRouter } from '@/modules/admin/admin.routes.js';
import { authRouter } from '@/modules/auth/auth.routes.js';
import { healthRouter } from '@/modules/health/health.route.js';

/**
 * Build the Express app without opening a port, so tests can drive it with Supertest.
 */
export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  // Match this to the real number of proxies in front of the API.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as express.Request).id }));
  app.use(helmet());
  // Native apps don't send an Origin header; CORS only matters for browser clients (e.g. Expo web).
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(globalRateLimiter);

  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', adminRateLimiter, adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
