import { sharedConfig } from './jest.shared.js';

/**
 * Integration tests against a real PostgreSQL database. Run with `pnpm test:integration`,
 * which loads .env.test (DATABASE_URL on port 5433) before Jest imports any module.
 */
export default {
  ...sharedConfig,
  testMatch: ['**/*.integration.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/integration/setup.ts'],
  maxWorkers: 1,
};
