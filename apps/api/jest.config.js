import { sharedConfig } from './jest.shared.js';

/** Unit + HTTP tests. No database required. */
export default {
  ...sharedConfig,
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/test/**', '!src/types/**', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
};
