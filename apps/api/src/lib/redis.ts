import { Redis } from 'ioredis';
import { env } from '@config/env.js';

let connection: Redis | null = null;

/**
 * Shared Redis connection for BullMQ queues and workers. Created on first use so that merely
 * importing a module (e.g. in unit tests) never opens a connection.
 */
export function getRedisConnection(): Redis {
  // BullMQ requires maxRetriesPerRequest: null so blocking worker commands are never aborted.
  connection ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

/** Options shared by every BullMQ Queue and Worker in this app. */
export function queueOptions() {
  return { connection: getRedisConnection(), prefix: `bull:${env.QUEUE_PREFIX}` };
}

export async function closeRedis(): Promise<void> {
  if (!connection) return;
  const current = connection;
  connection = null;
  await current.quit();
}
