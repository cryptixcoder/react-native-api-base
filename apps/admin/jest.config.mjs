import nextJest from 'next/jest.js';

// next/jest wires up the Next.js SWC transform, CSS/image/font mocks and .env loading.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // `server-only` throws outside React Server Components; in unit tests it's a no-op.
    '^server-only$': '<rootDir>/src/test/empty-module.ts',
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/components/ui/**', '!src/components/charts/**', '!src/test/**', '!src/**/__tests__/**'],
  coverageProvider: 'v8',
};

export default createJestConfig(config);
