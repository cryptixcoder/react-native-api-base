import { Queue } from 'bullmq';
import { env } from '@config/env.js';
import { queueOptions } from '@/lib/redis.js';

export const MAINTENANCE_QUEUE = 'maintenance';
export const AUTH_CLEANUP_JOB = 'auth-cleanup';

let queue: Queue | null = null;

function getMaintenanceQueue(): Queue {
  queue ??= new Queue(MAINTENANCE_QUEUE, {
    ...queueOptions(),
    defaultJobOptions: { removeOnComplete: 50, removeOnFail: 50 },
  });
  return queue;
}

/**
 * Register (or update) the recurring cleanup job. Idempotent, so every worker can call it on startup
 * without creating duplicates; changing CLEANUP_CRON updates the existing schedule.
 */
export async function scheduleAuthCleanup(): Promise<void> {
  await getMaintenanceQueue().upsertJobScheduler(AUTH_CLEANUP_JOB, { pattern: env.CLEANUP_CRON, tz: 'UTC' }, { name: AUTH_CLEANUP_JOB });
}

export async function closeMaintenanceQueue(): Promise<void> {
  if (!queue) return;
  const current = queue;
  queue = null;
  await current.close();
}
