import { env } from '@config/env.js';
import { prisma } from '@/lib/prisma.js';

export interface CleanupResult {
  sessions: number;
  passwordResetTokens: number;
  emailVerificationTokens: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Delete auth data that can never be used again:
 * - sessions past their expiry, and revoked sessions older than REVOKED_SESSION_RETENTION_DAYS
 *   (kept briefly for auditing "where am I signed in / signed out")
 * - password reset and email verification tokens that are expired or already used
 */
export async function cleanupExpiredAuthData(now = new Date()): Promise<CleanupResult> {
  const revokedBefore = new Date(now.getTime() - env.REVOKED_SESSION_RETENTION_DAYS * DAY_MS);
  const deadTokens = { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] };

  const [sessions, passwordResetTokens, emailVerificationTokens] = await prisma.$transaction([
    prisma.authSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: revokedBefore } }] },
    }),
    prisma.passwordResetToken.deleteMany({ where: deadTokens }),
    prisma.emailVerificationToken.deleteMany({ where: deadTokens }),
  ]);

  return {
    sessions: sessions.count,
    passwordResetTokens: passwordResetTokens.count,
    emailVerificationTokens: emailVerificationTokens.count,
  };
}
