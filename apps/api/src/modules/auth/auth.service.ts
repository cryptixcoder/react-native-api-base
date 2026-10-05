import { Prisma, prisma, type User } from '@repo/database';
import { env } from '@config/env.js';
import { generateSecureToken, hashPassword, hashToken, verifyPassword } from '@/utils/crypto.js';
import { createAccessToken, createRefreshToken } from '@/modules/auth/auth.tokens.js';
import type { AuthResponse, PublicUser } from '@/modules/auth/auth.types.js';
import type { LoginInput, RegisterInput } from '@/modules/auth/auth.schema.js';

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

function getRefreshTokenExpiration(): Date {
  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS);

  return expiresAt;
}

function getVerificationTokenExpiration(): Date {
  const expiresAt = new Date();

  expiresAt.setHours(expiresAt.getHours() + env.EMAIL_VERIFICATION_EXPIRES_IN_HOURS);

  return expiresAt;
}

function getPasswordResetTokenExpiration(): Date {
  const expiresAt = new Date();

  expiresAt.setMinutes(expiresAt.getMinutes() + env.PASSWORD_RESET_EXPIRES_IN_MINUTES);

  return expiresAt;
}

function isUniqueContraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function createSession(params: { user: User; userAgent?: string; ipAddress?: string }): Promise<AuthResponse> {
  const { rawToken, hash } = createRefreshToken();

  const session = await prisma.authSession.create({
    data: {},
  });
}
