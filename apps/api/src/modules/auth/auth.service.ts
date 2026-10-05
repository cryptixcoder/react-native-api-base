import { Prisma, type User } from '@repo/database';
import { env } from '@config/env.js';
import { logger } from '@/lib/logger.js';
import { prisma } from '@/lib/prisma.js';
import { AppError } from '@/middleware/error-handler.js';
import { generateSecureToken, hashPassword, hashToken, verifyPassword } from '@/utils/crypto.js';
import { createAccessToken, createRefreshToken } from '@/modules/auth/auth.tokens.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/modules/auth/auth.mail.js';
import type { AuthResponse, PublicUser, RequestMetadata } from '@/modules/auth/auth.types.js';
import type { LoginInput, RegisterInput } from '@/modules/auth/auth.schema.js';

export class AuthServiceError extends AppError {
  constructor(message: string, code: string, status: number) {
    super(status, code, message);
    this.name = 'AuthServiceError';
  }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

function addMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

const getRefreshTokenExpiration = () => addMinutes(env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60);
const getVerificationTokenExpiration = () => addMinutes(env.EMAIL_VERIFICATION_EXPIRES_IN_HOURS * 60);
const getPasswordResetTokenExpiration = () => addMinutes(env.PASSWORD_RESET_EXPIRES_IN_MINUTES);

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const invalidCredentials = () => new AuthServiceError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
const accountInactive = () => new AuthServiceError('This account is not active', 'ACCOUNT_INACTIVE', 403);

export async function createSession(params: { user: User } & RequestMetadata): Promise<AuthResponse> {
  const { rawToken, tokenHash } = createRefreshToken();

  await prisma.authSession.create({
    data: {
      userId: params.user.id,
      refreshTokenHash: tokenHash,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
      expiresAt: getRefreshTokenExpiration(),
    },
  });

  return {
    user: toPublicUser(params.user),
    accessToken: createAccessToken({ userId: params.user.id, role: params.user.role }),
    refreshToken: rawToken,
  };
}

/**
 * Invalidate outstanding verification tokens, create a new one and email it.
 * Email failures are logged, not thrown; add a job queue with retries for production.
 */
async function issueVerificationEmail(user: User): Promise<void> {
  const rawToken = generateSecureToken();

  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: getVerificationTokenExpiration(),
    },
  });

  try {
    await sendVerificationEmail({ to: user.email, firstName: user.firstName, token: rawToken });
  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'verification email failed');
  }
}

export async function register(input: RegisterInput, metadata: RequestMetadata = {}): Promise<AuthResponse> {
  const passwordHash = await hashPassword(input.password);

  let user: User;

  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthServiceError('An account with this email already exists', 'EMAIL_ALREADY_EXISTS', 409);
    }

    throw error;
  }

  await issueVerificationEmail(user);

  return createSession({ user, ...metadata });
}

export async function login(input: LoginInput, metadata: RequestMetadata = {}): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same error for unknown email and wrong password, so accounts cannot be enumerated.
  if (!user || !user.passwordHash) {
    throw invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw invalidCredentials();
  }

  if (user.status !== 'ACTIVE') {
    throw accountInactive();
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return createSession({ user: updatedUser, ...metadata });
}

/**
 * Exchange a refresh token for a new token pair. The old session is revoked and replaced
 * inside a transaction, so a refresh token can only ever be used once.
 */
export async function refreshSession(params: { refreshToken: string } & RequestMetadata): Promise<AuthResponse> {
  const oldSession = await prisma.authSession.findUnique({
    where: { refreshTokenHash: hashToken(params.refreshToken) },
    include: { user: true },
  });

  if (!oldSession || oldSession.revokedAt || oldSession.expiresAt <= new Date()) {
    throw new AuthServiceError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  if (oldSession.user.status !== 'ACTIVE') {
    throw accountInactive();
  }

  const newRefreshToken = createRefreshToken();

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.authSession.updateMany({
      where: { id: oldSession.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // A concurrent request already rotated this token.
    if (revoked.count !== 1) {
      throw new AuthServiceError('Refresh token has already been used', 'REFRESH_TOKEN_REUSE', 401);
    }

    await tx.authSession.create({
      data: {
        userId: oldSession.userId,
        refreshTokenHash: newRefreshToken.tokenHash,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
        expiresAt: getRefreshTokenExpiration(),
      },
    });
  });

  return {
    user: toPublicUser(oldSession.user),
    accessToken: createAccessToken({ userId: oldSession.user.id, role: oldSession.user.role }),
    refreshToken: newRefreshToken.rawToken,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.status !== 'ACTIVE') {
    throw new AuthServiceError('User not found', 'USER_NOT_FOUND', 404);
  }

  return toPublicUser(user);
}

/**
 * Always resolves, whether or not the account exists, to prevent account enumeration.
 */
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
    return;
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateSecureToken();

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: getPasswordResetTokenExpiration(),
    },
  });

  try {
    await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, token: rawToken });
  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'password reset email failed');
  }
}

export async function resetPassword(params: { token: string; newPassword: string }): Promise<void> {
  const invalidToken = () => new AuthServiceError('Invalid or expired password reset token', 'INVALID_RESET_TOKEN', 400);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(params.token) },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    throw invalidToken();
  }

  const passwordHash = await hashPassword(params.newPassword);

  await prisma.$transaction(async (tx) => {
    // Consume the token first, guarded against concurrent use.
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw invalidToken();
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Sign the user out on every device.
    await tx.authSession.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function verifyEmail(token: string): Promise<PublicUser> {
  const invalidToken = () => new AuthServiceError('Invalid or expired verification token', 'INVALID_VERIFICATION_TOKEN', 400);

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= new Date()) {
    throw invalidToken();
  }

  const user = await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: verificationToken.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw invalidToken();
    }

    return tx.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: new Date() },
    });
  });

  return toPublicUser(user);
}

/**
 * Always resolves, whether or not the account exists or is already verified.
 */
export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.emailVerifiedAt || user.status !== 'ACTIVE') {
    return;
  }

  await issueVerificationEmail(user);
}
