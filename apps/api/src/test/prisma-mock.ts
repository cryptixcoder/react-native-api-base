import { jest } from '@jest/globals';
import { mockDeep, mockReset, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '@repo/database';

/**
 * Deep mock of the Prisma client for unit tests.
 *
 * Usage (before importing the code under test):
 *
 *   import { prismaMock, mockPrisma } from '@/test/prisma-mock.js';
 *   mockPrisma();
 *   const authService = await import('@/modules/auth/auth.service.js');
 */
export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

function useTransactionPassthrough(): void {
  // Interactive transactions run their callback against the same mock; array transactions resolve each promise.
  prismaMock.$transaction.mockImplementation(((arg: unknown) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg as Promise<unknown>[])) as never);
}

export function mockPrisma(): void {
  jest.unstable_mockModule('@/lib/prisma.js', () => ({ prisma: prismaMock }));

  beforeEach(() => {
    mockReset(prismaMock);
    useTransactionPassthrough();
  });
}
