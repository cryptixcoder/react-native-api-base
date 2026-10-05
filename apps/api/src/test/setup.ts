/**
 * Global setup for unit tests (runs before each test file is imported).
 * Provides a complete, valid environment so unit tests never need a .env file
 * and never touch real services. Values already set (e.g. from .env.test) win.
 */
const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/app_test?schema=public',
  API_URL: 'http://localhost:4001',
  MOBILE_APP_URL: 'myapp://',
  LOG_LEVEL: 'silent',
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-1234567890',
  RESEND_API_KEY: '',
  RESEND_FROM_EMAIL: 'Test <test@example.com>',
};

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] ??= value;
}
