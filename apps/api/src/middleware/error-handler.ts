import type { ErrorRequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { env } from '@config/env.js';
import { logger } from '@/lib/logger.js';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: z.flattenError(error), requestId: req.id },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: req.id } });
    return;
  }

  // Malformed JSON bodies and other errors raised by Express' body parser carry a 4xx status.
  if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({ error: { code: 'BAD_REQUEST', message: 'Malformed request', requestId: req.id } });
    return;
  }

  logger.error({ err: error, requestId: req.id }, 'request failed');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.id,
      ...(env.NODE_ENV !== 'production' && error instanceof Error && { stack: error.stack }),
    },
  });
};
