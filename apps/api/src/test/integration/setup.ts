import { prisma } from '@/lib/prisma.js';

/**
 * Integration tests run against the real database from .env.test. Refuse to run anywhere else,
 * because every test truncates all tables.
 */
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error(`Integration tests require a *_test database. DATABASE_URL=${process.env.DATABASE_URL ?? '(unset)'}`);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "auth_sessions", "password_reset_tokens", "email_verification_tokens", "users" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
