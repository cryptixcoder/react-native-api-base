import { jest } from '@jest/globals';
import request from 'supertest';
import { buildUser } from '@/test/fixtures.js';
import { mockPrisma, prismaMock } from '@/test/prisma-mock.js';

// HTTP-layer tests: real Express app, routing, validation and auth middleware, with Prisma mocked.
mockPrisma();
jest.unstable_mockModule('@/modules/auth/auth.mail.js', () => ({
  sendVerificationEmail: jest.fn(async () => undefined),
  sendPasswordResetEmail: jest.fn(async () => undefined),
}));

const { createApp } = await import('@/app.js');
const { createAccessToken } = await import('@/modules/auth/auth.tokens.js');

const app = createApp();

describe('auth routes (HTTP)', () => {
  it('returns a validation error envelope for invalid registration input', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', requestId: expect.any(String) });
    expect(response.body.error.details.fieldErrors).toHaveProperty('email');
    expect(response.body.error.details.fieldErrors).toHaveProperty('password');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await request(app).post('/api/v1/auth/login').set('content-type', 'application/json').send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 401 from /me without a bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 from /me with an invalid token', async () => {
    const response = await request(app).get('/api/v1/auth/me').set('authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('returns the current user from /me with a valid token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    const token = createAccessToken({ userId: 'user-123', role: 'USER' });

    const response = await request(app).get('/api/v1/auth/me').set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: 'user-123', email: 'user@example.com' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-123' } });
  });

  it('normalizes the email before looking up the user on login', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/login').send({ email: '  USER@Example.com ', password: 'whatever' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
  });

  it('returns the same forgot-password response whether or not the account exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'missing@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/If an account exists/);
  });

  it('hides internal error details behind a 500 envelope', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('database exploded'));

    const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'user@example.com' });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
  });
});
