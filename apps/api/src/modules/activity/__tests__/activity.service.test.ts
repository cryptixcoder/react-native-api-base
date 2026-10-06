import { mockPrisma, prismaMock } from '@/test/prisma-mock.js';

mockPrisma();

const { flushActivity, parseClientInfo, recordActivity, resetActivityCache, trackActivity } = await import('@/modules/activity/activity.service.js');

beforeEach(() => {
  resetActivityCache();
});

describe('parseClientInfo', () => {
  it('normalizes known platforms and valid versions', () => {
    expect(parseClientInfo({ platform: ' iOS ', appVersion: '1.4.2' })).toEqual({ platform: 'ios', appVersion: '1.4.2' });
  });

  it('buckets unknown platforms and drops malformed versions', () => {
    expect(parseClientInfo({ platform: 'windows-phone', appVersion: '<script>' })).toEqual({ platform: 'other', appVersion: undefined });
  });

  it('handles missing headers', () => {
    expect(parseClientInfo({})).toEqual({ platform: undefined, appVersion: undefined });
  });
});

describe('recordActivity', () => {
  const now = new Date('2026-06-15T13:45:00Z');

  it('upserts one row per user per UTC day', async () => {
    await recordActivity('user-1', { platform: 'android', appVersion: '2.0.0' }, now);

    expect(prismaMock.userActivityDay.upsert).toHaveBeenCalledWith({
      where: { userId_day: { userId: 'user-1', day: new Date('2026-06-15') } },
      create: { userId: 'user-1', day: new Date('2026-06-15'), platform: 'android', appVersion: '2.0.0', firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now, platform: 'android', appVersion: '2.0.0' },
    });
  });

  it('skips the database for repeat activity on the same day', async () => {
    await recordActivity('user-1', {}, now);
    await recordActivity('user-1', {}, new Date('2026-06-15T20:00:00Z'));
    await recordActivity('user-1', {}, new Date('2026-06-16T08:00:00Z'));

    expect(prismaMock.userActivityDay.upsert).toHaveBeenCalledTimes(2);
  });

  it('does not count admin panel requests as product usage', async () => {
    trackActivity('admin-1', parseClientInfo({ platform: 'admin' }));
    await flushActivity();

    expect(prismaMock.userActivityDay.upsert).not.toHaveBeenCalled();
  });

  it('never throws from trackActivity', async () => {
    prismaMock.userActivityDay.upsert.mockRejectedValue(new Error('database down'));

    expect(() => trackActivity('user-1')).not.toThrow();
    await expect(flushActivity()).resolves.toBeUndefined();
  });
});
