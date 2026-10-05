import { jest } from '@jest/globals';
import { Prisma } from '@repo/database';
import { buildSession, buildUser, futureDate, pastDate } from '@/test/fixtures.js';
import { mockPrisma, prismaMock } from '@/test/prisma-mock.js';
import { hashPassword, hashToken } from '@/utils/crypto.js';

mockPrisma();

const sendVerificationEmail = jest.fn<(params: { to: string; firstName?: string | null; token: string }) => Promise<void>>();
const sendPasswordResetEmail = jest.fn<(params: { to: string; firstName?: string | null; token: string }) => Promise<void>>();

jest.unstable_mockModule('@/modules/auth/auth.mail.js', () => ({ sendVerificationEmail, sendPasswordResetEmail }));

const authService = await import('@/modules/auth/auth.service.js');
const { verifyAccessToken } = await import('@/modules/auth/auth.tokens.js');

const PASSWORD = 'Secure-password-123';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  sendVerificationEmail.mockResolvedValue(undefined);
  sendPasswordResetEmail.mockResolvedValue(undefined);
  prismaMock.authSession.create.mockResolvedValue(buildSession());
});

describe('auth service', () => {
  describe('register', () => {
    it('creates a user with a hashed password, a verification token and a session', async () => {
      const user = buildUser();
      prismaMock.user.create.mockResolvedValue(user);

      const result = await authService.register({ email: user.email, password: PASSWORD, firstName: 'Test', lastName: 'User' });

      const createArgs = prismaMock.user.create.mock.calls[0]?.[0];
      expect(createArgs?.data).toMatchObject({ email: user.email, firstName: 'Test', lastName: 'User' });
      expect(createArgs?.data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(createArgs?.data.passwordHash).not.toContain(PASSWORD);

      // The emailed raw token is stored only as a hash.
      const emailedToken = sendVerificationEmail.mock.calls[0]?.[0].token as string;
      expect(sendVerificationEmail).toHaveBeenCalledWith({ to: user.email, firstName: 'Test', token: expect.any(String) });
      expect(prismaMock.emailVerificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: user.id, tokenHash: hashToken(emailedToken) }),
      });

      expect(result.user).toEqual(authService.toPublicUser(user));
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(verifyAccessToken(result.accessToken).sub).toBe(user.id);
      expect(prismaMock.authSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: user.id, refreshTokenHash: hashToken(result.refreshToken) }),
      });
    });

    it('rejects a duplicate email with 409', async () => {
      prismaMock.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: 'test' }));

      await expect(authService.register({ email: 'user@example.com', password: PASSWORD })).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
        status: 409,
      });
      expect(prismaMock.authSession.create).not.toHaveBeenCalled();
    });

    it('still succeeds when the verification email fails', async () => {
      prismaMock.user.create.mockResolvedValue(buildUser());
      sendVerificationEmail.mockRejectedValue(new Error('Resend down'));

      await expect(authService.register({ email: 'user@example.com', password: PASSWORD })).resolves.toHaveProperty('accessToken');
    });
  });

  describe('login', () => {
    it('logs in with valid credentials and records the login', async () => {
      const user = buildUser({ passwordHash });
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.update.mockResolvedValue({ ...user, lastLoginAt: new Date() });

      const result = await authService.login({ email: user.email, password: PASSWORD }, { userAgent: 'jest', ipAddress: '127.0.0.1' });

      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: user.id }, data: { lastLoginAt: expect.any(Date) } });
      expect(prismaMock.authSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userAgent: 'jest', ipAddress: '127.0.0.1' }),
      });
      expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects an incorrect password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

      await expect(authService.login({ email: 'user@example.com', password: 'wrong-password' })).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        status: 401,
      });
    });

    it('rejects an unknown email with the same error', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(authService.login({ email: 'missing@example.com', password: PASSWORD })).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        status: 401,
      });
    });

    it('rejects a suspended account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ passwordHash, status: 'SUSPENDED' }));

      await expect(authService.login({ email: 'user@example.com', password: PASSWORD })).rejects.toMatchObject({
        code: 'ACCOUNT_INACTIVE',
        status: 403,
      });
      expect(prismaMock.authSession.create).not.toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    const refreshToken = 'a'.repeat(64);

    it('rotates the refresh token', async () => {
      const user = buildUser();
      prismaMock.authSession.findUnique.mockResolvedValue({ ...buildSession({ refreshTokenHash: hashToken(refreshToken) }), user } as never);
      prismaMock.authSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await authService.refreshSession({ refreshToken });

      expect(prismaMock.authSession.findUnique).toHaveBeenCalledWith({ where: { refreshTokenHash: hashToken(refreshToken) }, include: { user: true } });
      expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(prismaMock.authSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: user.id, refreshTokenHash: hashToken(result.refreshToken) }),
      });
      expect(verifyAccessToken(result.accessToken).sub).toBe(user.id);
    });

    it.each([
      ['unknown', null],
      ['revoked', { ...buildSession({ revokedAt: pastDate() }), user: buildUser() }],
      ['expired', { ...buildSession({ expiresAt: pastDate() }), user: buildUser() }],
    ])('rejects a %s refresh token', async (_label, session) => {
      prismaMock.authSession.findUnique.mockResolvedValue(session as never);

      await expect(authService.refreshSession({ refreshToken })).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN', status: 401 });
      expect(prismaMock.authSession.create).not.toHaveBeenCalled();
    });

    it('rejects a token that a concurrent request already rotated', async () => {
      prismaMock.authSession.findUnique.mockResolvedValue({ ...buildSession(), user: buildUser() } as never);
      prismaMock.authSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(authService.refreshSession({ refreshToken })).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSE' });
      expect(prismaMock.authSession.create).not.toHaveBeenCalled();
    });

    it('rejects when the user is no longer active', async () => {
      prismaMock.authSession.findUnique.mockResolvedValue({ ...buildSession(), user: buildUser({ status: 'SUSPENDED' }) } as never);

      await expect(authService.refreshSession({ refreshToken })).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
    });
  });

  describe('logout', () => {
    it('revokes the session matching the refresh token', async () => {
      await authService.logout('raw-token');

      expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
        where: { refreshTokenHash: hashToken('raw-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokes every active session for logout-all', async () => {
      await authService.logoutAllDevices('user-123');

      expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('getCurrentUser', () => {
    it('returns the public user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser());

      await expect(authService.getCurrentUser('user-123')).resolves.not.toHaveProperty('passwordHash');
    });

    it('treats inactive users as not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser({ status: 'DELETED' }));

      await expect(authService.getCurrentUser('user-123')).rejects.toMatchObject({ code: 'USER_NOT_FOUND', status: 404 });
    });
  });

  describe('forgotPassword', () => {
    it('silently does nothing for an unknown email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(authService.forgotPassword('missing@example.com')).resolves.toBeUndefined();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('invalidates old tokens, stores a hashed token and emails the raw token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser());

      await authService.forgotPassword('user@example.com');

      expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      const emailedToken = sendPasswordResetEmail.mock.calls[0]?.[0].token as string;
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
        data: { userId: 'user-123', tokenHash: hashToken(emailedToken), expiresAt: expect.any(Date) },
      });
    });

    it('does not surface email delivery failures', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser());
      sendPasswordResetEmail.mockRejectedValue(new Error('Resend down'));

      await expect(authService.forgotPassword('user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    const resetToken = (overrides = {}) => ({
      id: 'reset-1',
      userId: 'user-123',
      tokenHash: hashToken('reset-token'),
      expiresAt: futureDate(),
      usedAt: null,
      createdAt: new Date(),
      ...overrides,
    });

    it('updates the password, consumes the token and revokes all sessions', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(resetToken());
      prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      await authService.resetPassword({ token: 'reset-token', newPassword: 'New-password-123' });

      expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken('reset-token') } });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: expect.stringMatching(/^\$argon2id\$/) },
      });
      expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it.each([
      ['unknown', null],
      ['expired', resetToken({ expiresAt: pastDate() })],
      ['used', resetToken({ usedAt: pastDate() })],
    ])('rejects an %s token', async (_label, token) => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(token);

      await expect(authService.resetPassword({ token: 'reset-token', newPassword: 'New-password-123' })).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
        status: 400,
      });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token consumed concurrently', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(resetToken());
      prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(authService.resetPassword({ token: 'reset-token', newPassword: 'New-password-123' })).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
      });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const verificationToken = (overrides = {}) => ({
      id: 'verify-1',
      userId: 'user-123',
      tokenHash: hashToken('verify-token'),
      expiresAt: futureDate(),
      usedAt: null,
      createdAt: new Date(),
      ...overrides,
    });

    it('marks the email verified', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue(verificationToken());
      prismaMock.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue(buildUser({ emailVerifiedAt: new Date() }));

      const user = await authService.verifyEmail('verify-token');

      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'user-123' }, data: { emailVerifiedAt: expect.any(Date) } });
    });

    it('rejects a reused token', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue(verificationToken({ usedAt: pastDate() }));

      await expect(authService.verifyEmail('verify-token')).rejects.toMatchObject({ code: 'INVALID_VERIFICATION_TOKEN', status: 400 });
    });
  });

  describe('resendVerification', () => {
    it('sends a new verification email to unverified users', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser());

      await authService.resendVerification('user@example.com');

      expect(prismaMock.emailVerificationToken.updateMany).toHaveBeenCalled();
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('does nothing for verified or unknown users', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(buildUser({ emailVerifiedAt: new Date() })).mockResolvedValueOnce(null);

      await authService.resendVerification('user@example.com');
      await authService.resendVerification('missing@example.com');

      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
