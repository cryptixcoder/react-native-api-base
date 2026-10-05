import { jest } from '@jest/globals';
import request from 'supertest';

type MailParams = { to: string; firstName?: string | null; token: string };

// Real Express app + real Prisma + PostgreSQL; only email delivery is mocked so tests can read the tokens.
const sendVerificationEmail = jest.fn<(params: MailParams) => Promise<void>>(async () => undefined);
const sendPasswordResetEmail = jest.fn<(params: MailParams) => Promise<void>>(async () => undefined);
jest.unstable_mockModule('@/modules/auth/auth.mail.js', () => ({ sendVerificationEmail, sendPasswordResetEmail }));

const { createApp } = await import('@/app.js');
const { prisma } = await import('@/lib/prisma.js');

const app = createApp();
const PASSWORD = 'Secure-password-123';

async function registerUser(email = 'user@example.com') {
  const response = await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, firstName: 'Integration' });
  expect(response.status).toBe(201);
  return response.body as { accessToken: string; refreshToken: string; user: { id: string } };
}

describe('auth API (integration)', () => {
  describe('POST /register', () => {
    it('creates the user, a hashed password, a verification token and a session', async () => {
      const body = await registerUser('Integration@Example.com');

      const user = await prisma.user.findUnique({ where: { email: 'integration@example.com' } });
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await prisma.emailVerificationToken.count({ where: { userId: user?.id } })).toBe(1);
      expect(await prisma.authSession.count({ where: { userId: user?.id } })).toBe(1);
      expect(body.user.id).toBe(user?.id);
    });

    it('rejects a duplicate email', async () => {
      await registerUser();

      const response = await request(app).post('/api/v1/auth/register').send({ email: 'user@example.com', password: PASSWORD });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('POST /login and GET /me', () => {
    it('logs in and fetches the current user', async () => {
      await registerUser();

      const login = await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: PASSWORD });
      expect(login.status).toBe(200);

      const me = await request(app).get('/api/v1/auth/me').set('authorization', `Bearer ${login.body.accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('user@example.com');

      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'user@example.com' } });
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it('rejects incorrect credentials', async () => {
      await registerUser();

      const response = await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: 'wrong-password' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /refresh', () => {
    it('rotates the refresh token and rejects the old one', async () => {
      const { refreshToken } = await registerUser();

      const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(first.status).toBe(200);
      expect(first.body.refreshToken).not.toBe(refreshToken);

      const reused = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(reused.status).toBe(401);
      expect(reused.body.error.code).toBe('INVALID_REFRESH_TOKEN');

      const second = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken });
      expect(second.status).toBe(200);
    });

    it('lets only one of two concurrent refreshes with the same token succeed', async () => {
      const { refreshToken } = await registerUser();

      const results = await Promise.all([
        request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
        request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    });
  });

  describe('POST /logout and /logout-all', () => {
    it('revokes the current session', async () => {
      const { refreshToken } = await registerUser();

      const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
      expect(logout.status).toBe(200);

      const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(refresh.status).toBe(401);
    });

    it('revokes every session', async () => {
      const first = await registerUser();
      const second = await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: PASSWORD });

      const response = await request(app).post('/api/v1/auth/logout-all').set('authorization', `Bearer ${first.accessToken}`);
      expect(response.status).toBe(200);

      expect(await prisma.authSession.count({ where: { revokedAt: null } })).toBe(0);
      expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: second.body.refreshToken })).status).toBe(401);
    });
  });

  describe('password reset', () => {
    it('resets the password with the emailed token and revokes sessions', async () => {
      const { refreshToken } = await registerUser();

      const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'user@example.com' });
      expect(forgot.status).toBe(200);
      const token = sendPasswordResetEmail.mock.calls[0]?.[0].token as string;

      const reset = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'New-password-456' });
      expect(reset.status).toBe(200);

      // Old sessions and the old password no longer work; the new password does.
      expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: PASSWORD })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: 'New-password-456' })).status).toBe(200);

      // The token is single-use.
      const reuse = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'Another-password-789' });
      expect(reuse.status).toBe(400);
      expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');
    });

    it('gives the same response for an unknown email', async () => {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'missing@example.com' });

      expect(response.status).toBe(200);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('email verification', () => {
    it('verifies the email with the emailed token exactly once', async () => {
      await registerUser();
      const token = sendVerificationEmail.mock.calls[0]?.[0].token as string;

      const verify = await request(app).post('/api/v1/auth/verify-email').send({ token });
      expect(verify.status).toBe(200);
      expect(verify.body.user.emailVerifiedAt).toEqual(expect.any(String));

      const reuse = await request(app).post('/api/v1/auth/verify-email').send({ token });
      expect(reuse.status).toBe(400);
    });

    it('invalidates the previous token when verification is resent', async () => {
      await registerUser();
      const firstToken = sendVerificationEmail.mock.calls[0]?.[0].token as string;

      await request(app).post('/api/v1/auth/resend-verification').send({ email: 'user@example.com' });
      const secondToken = sendVerificationEmail.mock.calls[1]?.[0].token as string;

      expect((await request(app).post('/api/v1/auth/verify-email').send({ token: firstToken })).status).toBe(400);
      expect((await request(app).post('/api/v1/auth/verify-email').send({ token: secondToken })).status).toBe(200);
    });
  });
});
