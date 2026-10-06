import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('@/modules/auth/auth.mail.js', () => ({
  sendVerificationEmail: jest.fn(async () => undefined),
  sendPasswordResetEmail: jest.fn(async () => undefined),
}));

const { createApp } = await import('@/app.js');
const { prisma } = await import('@/lib/prisma.js');
const { flushActivity, resetActivityCache } = await import('@/modules/activity/activity.service.js');

const app = createApp();
const PASSWORD = 'Secure-password-123';
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const utcDay = (date: Date) => new Date(date.toISOString().slice(0, 10));

interface Session {
  id: string;
  accessToken: string;
  refreshToken: string;
}

async function register(email: string, headers: Record<string, string> = {}): Promise<Session> {
  const response = await request(app).post('/api/v1/auth/register').set(headers).send({ email, password: PASSWORD, firstName: 'Test' });
  expect(response.status).toBe(201);
  await flushActivity();
  return { id: response.body.user.id, accessToken: response.body.accessToken, refreshToken: response.body.refreshToken };
}

async function registerAdmin(email = 'admin@example.com'): Promise<Session> {
  const session = await register(email);
  await prisma.user.update({ where: { id: session.id }, data: { role: 'ADMIN' } });
  return session;
}

const as = (session: Session) => ({ authorization: `Bearer ${session.accessToken}` });

beforeEach(() => {
  resetActivityCache();
});

describe('admin API (integration)', () => {
  describe('access control', () => {
    it('rejects requests without a token', async () => {
      expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const user = await register('user@example.com');

      const response = await request(app).get('/api/v1/admin/users').set(as(user));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('applies a role change immediately, without waiting for the token to expire', async () => {
      const user = await register('user@example.com');
      expect((await request(app).get('/api/v1/admin/users').set(as(user))).status).toBe(403);

      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

      expect((await request(app).get('/api/v1/admin/users').set(as(user))).status).toBe(200);
    });
  });

  describe('suspending users', () => {
    it('locks the user out immediately and records the action', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');

      const suspend = await request(app).post(`/api/v1/admin/users/${user.id}/suspend`).set(as(admin)).send({ reason: 'Spam reports' });
      expect(suspend.status).toBe(200);
      expect(suspend.body.data).toMatchObject({ status: 'SUSPENDED', suspendedReason: 'Spam reports' });

      // Existing access token stops working right away; refresh and login are refused.
      const me = await request(app).get('/api/v1/auth/me').set(as(user));
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('ACCOUNT_INACTIVE');
      expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: PASSWORD })).status).toBe(403);

      const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { targetUserId: user.id } });
      expect(audit).toMatchObject({ actorId: admin.id, action: 'user.suspended', metadata: { reason: 'Spam reports', sessionsRevoked: 1 } });
    });

    it('lets the user sign in again after unsuspending', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');
      await request(app).post(`/api/v1/admin/users/${user.id}/suspend`).set(as(admin)).send({ reason: 'Investigating' });

      const unsuspend = await request(app).post(`/api/v1/admin/users/${user.id}/unsuspend`).set(as(admin));

      expect(unsuspend.body.data).toMatchObject({ status: 'ACTIVE', suspendedAt: null, suspendedReason: null });
      expect((await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: PASSWORD })).status).toBe(200);
    });

    it('requires a reason', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');

      const response = await request(app).post(`/api/v1/admin/users/${user.id}/suspend`).set(as(admin)).send({ reason: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents admins from suspending, demoting or deleting themselves', async () => {
      const admin = await registerAdmin();

      const responses = await Promise.all([
        request(app).post(`/api/v1/admin/users/${admin.id}/suspend`).set(as(admin)).send({ reason: 'oops' }),
        request(app).patch(`/api/v1/admin/users/${admin.id}/role`).set(as(admin)).send({ role: 'USER' }),
        request(app).delete(`/api/v1/admin/users/${admin.id}`).set(as(admin)),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CANNOT_MODIFY_SELF');
      }
    });
  });

  describe('deleting users', () => {
    it('anonymizes the account, signs it out and frees the email', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');

      const response = await request(app).delete(`/api/v1/admin/users/${user.id}`).set(as(admin));

      expect(response.status).toBe(200);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored).toMatchObject({
        status: 'DELETED',
        email: `deleted+${user.id}@deleted.invalid`,
        firstName: null,
        lastName: null,
        passwordHash: null,
      });
      expect(stored.deletedAt).toBeInstanceOf(Date);
      expect(await prisma.authSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
      expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(0);
      expect((await request(app).get('/api/v1/auth/me').set(as(user))).status).toBe(401);

      // The same email address can register a brand-new account.
      await register('user@example.com');

      // Deleted accounts can't be modified further.
      const again = await request(app).post(`/api/v1/admin/users/${user.id}/suspend`).set(as(admin)).send({ reason: 'again' });
      expect(again.body.error.code).toBe('USER_DELETED');
    });
  });

  describe('other actions', () => {
    it('signs a user out everywhere without suspending them', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');

      const response = await request(app).post(`/api/v1/admin/users/${user.id}/revoke-sessions`).set(as(admin));

      expect(response.body.data).toEqual({ revoked: 1 });
      expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').send({ email: 'user@example.com', password: PASSWORD })).status).toBe(200);
    });

    it('verifies an email manually', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');

      const response = await request(app).post(`/api/v1/admin/users/${user.id}/verify-email`).set(as(admin));

      expect(response.body.data.emailVerifiedAt).toEqual(expect.any(String));
      expect((await request(app).post(`/api/v1/admin/users/${user.id}/verify-email`).set(as(admin))).body.error.code).toBe('ALREADY_VERIFIED');
    });

    it('promotes a user to admin', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');

      const response = await request(app).patch(`/api/v1/admin/users/${user.id}/role`).set(as(admin)).send({ role: 'ADMIN' });

      expect(response.body.data.role).toBe('ADMIN');
      expect((await request(app).get('/api/v1/admin/users').set(as(user))).status).toBe(200);
    });
  });

  describe('listing and inspecting users', () => {
    it('searches, filters and paginates', async () => {
      const admin = await registerAdmin();
      await register('alice@example.com');
      await register('bob@example.com');
      const carol = await register('carol@example.com');
      await request(app).post(`/api/v1/admin/users/${carol.id}/suspend`).set(as(admin)).send({ reason: 'Testing' });

      const search = await request(app).get('/api/v1/admin/users?search=ALICE').set(as(admin));
      expect(search.body.data.map((u: { email: string }) => u.email)).toEqual(['alice@example.com']);
      expect(search.body.data[0]).not.toHaveProperty('passwordHash');

      const suspended = await request(app).get('/api/v1/admin/users?status=SUSPENDED').set(as(admin));
      expect(suspended.body.total).toBe(1);

      const page = await request(app).get('/api/v1/admin/users?pageSize=2&page=2&sort=email&order=asc').set(as(admin));
      expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 4 });
      expect(page.body.data.map((u: { email: string }) => u.email)).toEqual(['bob@example.com', 'carol@example.com']);
    });

    it('returns sessions, activity and audit history for a user', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com', { 'x-client-platform': 'ios', 'x-app-version': '1.2.0' });
      await request(app).post(`/api/v1/admin/users/${user.id}/verify-email`).set(as(admin));

      const response = await request(app).get(`/api/v1/admin/users/${user.id}`).set(as(admin));

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.activity).toEqual([{ day: new Date().toISOString().slice(0, 10), platform: 'ios', appVersion: '1.2.0' }]);
      expect(response.body.data.audit[0]).toMatchObject({ action: 'user.email_verified', actor: { email: 'admin@example.com' } });
    });

    it('lists the audit log newest first', async () => {
      const admin = await registerAdmin();
      const user = await register('user@example.com');
      await request(app).post(`/api/v1/admin/users/${user.id}/suspend`).set(as(admin)).send({ reason: 'One' });
      await request(app).post(`/api/v1/admin/users/${user.id}/unsuspend`).set(as(admin));

      const response = await request(app).get('/api/v1/admin/audit-log').set(as(admin));

      expect(response.body.total).toBe(2);
      expect(response.body.data.map((entry: { action: string }) => entry.action)).toEqual(['user.unsuspended', 'user.suspended']);
    });
  });

  describe('analytics', () => {
    /** Create a user who signed up `signupDaysAgo` days ago and was active on the given days-ago. */
    async function seedUser(email: string, signupDaysAgo: number, activeDaysAgo: number[], extra: { verified?: boolean; platform?: string; appVersion?: string } = {}) {
      const user = await prisma.user.create({
        data: { email, passwordHash: 'hash', createdAt: daysAgo(signupDaysAgo), emailVerifiedAt: extra.verified ? daysAgo(signupDaysAgo) : null },
      });
      await prisma.userActivityDay.createMany({
        data: activeDaysAgo.map((ago) => ({ userId: user.id, day: utcDay(daysAgo(ago)), platform: extra.platform ?? 'ios', appVersion: extra.appVersion ?? '1.0.0' })),
      });
      return user;
    }

    it('computes the overview KPIs', async () => {
      const admin = await registerAdmin(); // signs up and is active today
      await seedUser('a@example.com', 2, [2, 1, 0], { verified: true });
      await seedUser('b@example.com', 3, [3], { platform: 'android' });
      await seedUser('old@example.com', 40, [40, 10]);

      const response = await request(app).get('/api/v1/admin/analytics/overview?days=7').set(as(admin));
      const data = response.body.data;

      expect(response.status).toBe(200);
      expect(data.users).toEqual({ total: 4, active: 4, suspended: 0, deleted: 0 });
      expect(data.newUsers.current).toBe(3); // admin, a, b
      expect(data.wau.current).toBe(3); // admin, a, b
      expect(data.mau.current).toBe(4); // + old (active 10 days ago)
      // Activity rows in the last 7 days: admin 1 + a 3 + b 1 = 5, averaged over 7 days.
      expect(data.dau.current).toBeCloseTo(5 / 7);
      expect(data.verificationRate.current).toBeCloseTo(1 / 3);
      expect(data.activeSessions).toBe(1);
    });

    it('returns a gap-free daily series', async () => {
      const admin = await registerAdmin();
      await seedUser('a@example.com', 2, [2, 0]);

      const response = await request(app).get('/api/v1/admin/analytics/timeseries?days=7').set(as(admin));
      const series = response.body.data as { date: string; signups: number; activeUsers: number }[];

      expect(series).toHaveLength(7);
      expect(series.at(-1)).toEqual({ date: new Date().toISOString().slice(0, 10), signups: 1, activeUsers: 2 });
      expect(series.at(-3)).toMatchObject({ signups: 1, activeUsers: 1 });
      expect(series.at(-2)).toMatchObject({ signups: 0, activeUsers: 0 });
    });

    it('builds the activation funnel and platform breakdown', async () => {
      const admin = await registerAdmin();
      await seedUser('returned@example.com', 20, [20, 19, 12], { verified: true, platform: 'android', appVersion: '2.0.0' });
      await seedUser('once@example.com', 20, [20], { platform: 'ios', appVersion: '2.0.0' });

      const funnel = await request(app).get('/api/v1/admin/analytics/funnel?days=30').set(as(admin));
      expect(funnel.body.data).toEqual([
        { step: 'Registered', users: 3 },
        { step: 'Verified email', users: 1 },
        { step: 'Returned', users: 1 },
        { step: 'Active after 7 days', users: 1 },
      ]);

      const breakdown = await request(app).get('/api/v1/admin/analytics/breakdown?days=30').set(as(admin));
      expect(breakdown.body.data.platforms).toEqual(
        expect.arrayContaining([
          { platform: 'android', users: 1 },
          { platform: 'ios', users: 1 },
        ]),
      );
      expect(breakdown.body.data.appVersions).toEqual(expect.arrayContaining([{ version: '2.0.0', users: 2 }]));
    });

    it('computes weekly retention cohorts', async () => {
      const admin = await registerAdmin();
      // Two users who signed up 14 days ago (cohort two weeks back); one came back the following week.
      await seedUser('kept@example.com', 14, [14, 7]);
      await seedUser('lost@example.com', 14, [14]);

      const response = await request(app).get('/api/v1/admin/analytics/retention?weeks=4').set(as(admin));
      const cohorts = response.body.data as { cohort: string; size: number; retention: (number | null)[] }[];
      const cohort = cohorts.find((c) => c.size === 2)!;

      expect(cohort.retention[0]).toBe(1);
      expect(cohort.retention.slice(0, 3).some((value) => value === 0.5)).toBe(true);
      // The current week's cohort (the admin) has no future weeks yet.
      expect(cohorts.at(-1)!.retention.at(-1)).toBeNull();
    });

    it('rejects unsupported ranges', async () => {
      const admin = await registerAdmin();

      const response = await request(app).get('/api/v1/admin/analytics/overview?days=12').set(as(admin));

      expect(response.status).toBe(400);
    });
  });
});
