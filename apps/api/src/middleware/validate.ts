import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validate and normalize request input. Parsed values replace req.body / req.params,
 * so handlers receive trimmed, lower-cased, defaulted data. ZodErrors reach the error handler.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      // Express 5 exposes req.query as a getter, so query is validated but not reassigned.
      if (schemas.query) schemas.query.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
