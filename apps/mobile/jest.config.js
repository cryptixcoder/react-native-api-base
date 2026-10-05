/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/src/test/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // Route files live in src/app, so screen tests live in src/__tests__/screens instead of next to them.
  moduleNameMapper: {
    '\\.css$': '<rootDir>/src/test/style-mock.js',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/*.d.ts', '!src/test/**', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
};
