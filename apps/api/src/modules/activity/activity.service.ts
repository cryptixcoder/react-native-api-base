import { logger } from '@/lib/logger.js';
import { prisma } from '@/lib/prisma.js';

/** `admin` is the admin panel itself; its requests are never counted as product usage. */
export type ClientPlatform = 'ios' | 'android' | 'web' | 'admin' | 'other';

export interface ClientInfo {
  platform?: ClientPlatform | undefined;
  appVersion?: string | undefined;
}

const PLATFORMS = new Set(['ios', 'android', 'web', 'admin']);
const VERSION_PATTERN = /^[\w.+-]{1,40}$/;

/**
 * Read the client identity the mobile app sends on every request
 * (x-client-platform: ios|android|web, x-app-version: 1.4.2). The admin panel sends `admin`.
 * Unknown values are normalized or dropped.
 */
export function parseClientInfo(headers: { platform?: string | undefined; appVersion?: string | undefined }): ClientInfo {
  const platform = headers.platform?.trim().toLowerCase();
  const appVersion = headers.appVersion?.trim();

  return {
    platform: platform ? (PLATFORMS.has(platform) ? (platform as ClientPlatform) : 'other') : undefined,
    appVersion: appVersion && VERSION_PATTERN.test(appVersion) ? appVersion : undefined,
  };
}

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

// Users already recorded today by this process, so repeat requests skip the database write.
let cacheDay = '';
const recordedToday = new Set<string>();

/**
 * Mark the user as active today (UTC). One row per user per day feeds DAU/WAU/MAU, retention and
 * platform analytics in the admin panel.
 */
export async function recordActivity(userId: string, client: ClientInfo = {}, now = new Date()): Promise<void> {
  const day = utcDay(now);

  if (day !== cacheDay) {
    cacheDay = day;
    recordedToday.clear();
  }

  const cacheKey = `${userId}:${client.platform ?? ''}:${client.appVersion ?? ''}`;
  if (recordedToday.has(cacheKey)) return;

  await prisma.userActivityDay.upsert({
    where: { userId_day: { userId, day: new Date(day) } },
    create: { userId, day: new Date(day), platform: client.platform ?? null, appVersion: client.appVersion ?? null, firstSeenAt: now, lastSeenAt: now },
    update: {
      lastSeenAt: now,
      ...(client.platform && { platform: client.platform }),
      ...(client.appVersion && { appVersion: client.appVersion }),
    },
  });

  recordedToday.add(cacheKey);
}

const pending = new Set<Promise<void>>();

/** Fire-and-forget wrapper: analytics must never fail or slow down the request that triggered it. */
export function trackActivity(userId: string, client: ClientInfo = {}): void {
  if (client.platform === 'admin') return;

  const write = recordActivity(userId, client)
    .catch((error: unknown) => {
      logger.warn({ err: error, userId }, 'failed to record user activity');
    })
    .finally(() => pending.delete(write));
  pending.add(write);
}

/** Wait for in-flight activity writes (tests, graceful shutdown). */
export async function flushActivity(): Promise<void> {
  await Promise.all([...pending]);
}

/** Test helper: forget which users were recorded today. */
export function resetActivityCache(): void {
  cacheDay = '';
  recordedToday.clear();
}
