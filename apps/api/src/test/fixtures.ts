import type { AuthSession, User } from '@repo/database';

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'user@example.com',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$placeholder',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    status: 'ACTIVE',
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    id: 'session-123',
    userId: 'user-123',
    refreshTokenHash: 'refresh-hash',
    userAgent: null,
    ipAddress: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export const futureDate = () => new Date(Date.now() + 60 * 60 * 1000);
export const pastDate = () => new Date(Date.now() - 60 * 1000);
