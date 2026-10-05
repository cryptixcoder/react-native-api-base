import { mockPrisma, prismaMock } from '@/test/prisma-mock.js';

mockPrisma();

const { cleanupExpiredAuthData } = await import('@/jobs/cleanup.js');

describe('cleanupExpiredAuthData', () => {
  it('deletes expired sessions, old revoked sessions, and expired or used tokens', async () => {
    prismaMock.authSession.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });
    const now = new Date('2026-06-15T03:00:00Z');

    const result = await cleanupExpiredAuthData(now);

    expect(result).toEqual({ sessions: 3, passwordResetTokens: 2, emailVerificationTokens: 1 });
    expect(prismaMock.authSession.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date('2026-06-08T03:00:00Z') } }] },
    });
    const deadTokens = { where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } };
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith(deadTokens);
    expect(prismaMock.emailVerificationToken.deleteMany).toHaveBeenCalledWith(deadTokens);
  });
});
