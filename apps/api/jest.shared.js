/**
 * Shared Jest settings. The API is native ESM (and TypeScript 7 has no compiler API for ts-jest),
 * so tests run with --experimental-vm-modules and @swc/jest strips types while keeping ESM.
 * Mock modules with `jest.unstable_mockModule()` + dynamic `await import()`; `jest.mock` hoisting
 * does not apply to ES modules.
 *
 * @type {import('jest').Config}
 */
export const sharedConfig = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
        module: { type: 'es6' },
      },
    ],
  },
  moduleNameMapper: {
    '^@config/(.*)\\.js$': '<rootDir>/src/config/$1',
    '^@/(.*)\\.js$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  clearMocks: true,
  restoreMocks: true,
};
