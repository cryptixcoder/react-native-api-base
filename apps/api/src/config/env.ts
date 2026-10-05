import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().min(1),
    // Backs the BullMQ job queues (email delivery, scheduled maintenance).
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    // Namespaces this project's queue keys so several projects can share one Redis.
    QUEUE_PREFIX: z.string().min(1).default('myapp'),

    API_URL: z.url(),
    // Base URL used in email links that should open the mobile app, e.g. myapp:// or https://app.example.com/
    MOBILE_APP_URL: z.string().min(1),

    CORS_ORIGINS: z.string().default('http://localhost:8081'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

    JWT_ACCESS_SECRET: z.string().min(32),

    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().default(30),

    // Optional outside production: without it, emails are written to the log instead of sent.
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().min(1),

    EMAIL_VERIFICATION_EXPIRES_IN_HOURS: z.coerce.number().default(24),
    PASSWORD_RESET_EXPIRES_IN_MINUTES: z.coerce.number().default(30),

    // Cron pattern (UTC) for deleting expired sessions and tokens, and how long revoked sessions are kept.
    CLEANUP_CRON: z.string().min(1).default('0 3 * * *'),
    REVOKED_SESSION_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(7),
  })
  .refine((value) => value.NODE_ENV !== 'production' || Boolean(value.RESEND_API_KEY), {
    message: 'RESEND_API_KEY is required in production',
    path: ['RESEND_API_KEY'],
  });

export const env = envSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(',').map((value) => value.trim());
