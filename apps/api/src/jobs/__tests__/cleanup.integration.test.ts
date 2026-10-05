const { prisma } = await import('@/lib/prisma.js');
const { cleanupExpiredAuthData } = await import('@/jobs/cleanup.js');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const ahead = (ms: number) => new Date(now.getTime() + ms);

describe('cleanupExpiredAuthData (integration)', () => {
  it('removes only dead sessions and tokens', async () => {
    const user = await prisma.user.create({ data: { email: 'cleanup@example.com', passwordHash: 'hash' } });
    const session = (id: string, data: { expiresAt: Date; revokedAt?: Date }) =>
      prisma.authSession.create({ data: { refreshTokenHash: id, userId: user.id, ...data } });
    const token = (id: string, data: { expiresAt: Date; usedAt?: Date }) => ({ tokenHash: id, userId: user.id, ...data });

    await Promise.all([
      session('live', { expiresAt: ahead(DAY) }),
      session('expired', { expiresAt: ago(1000) }),
      session('recently-revoked', { expiresAt: ahead(DAY), revokedAt: ago(DAY) }),
      session('long-revoked', { expiresAt: ahead(DAY), revokedAt: ago(8 * DAY) }),
      prisma.passwordResetToken.createMany({
        data: [token('reset-live', { expiresAt: ahead(DAY) }), token('reset-expired', { expiresAt: ago(1000) }), token('reset-used', { expiresAt: ahead(DAY), usedAt: ago(1000) })],
      }),
      prisma.emailVerificationToken.createMany({
        data: [token('verify-live', { expiresAt: ahead(DAY) }), token('verify-expired', { expiresAt: ago(1000) })],
      }),
    ]);

    const result = await cleanupExpiredAuthData(now);

    expect(result).toEqual({ sessions: 2, passwordResetTokens: 2, emailVerificationTokens: 1 });
    const remainingSessions = await prisma.authSession.findMany({ select: { refreshTokenHash: true } });
    expect(remainingSessions.map((s) => s.refreshTokenHash).sort()).toEqual(['live', 'recently-revoked']);
    expect((await prisma.passwordResetToken.findMany()).map((t) => t.tokenHash)).toEqual(['reset-live']);
    expect((await prisma.emailVerificationToken.findMany()).map((t) => t.tokenHash)).toEqual(['verify-live']);
    // Users are never touched.
    expect(await prisma.user.count()).toBe(1);
  });
});
