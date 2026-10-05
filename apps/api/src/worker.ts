import { Worker } from 'bullmq';
import { env } from '@config/env.js';
import { cleanupExpiredAuthData } from '@/jobs/cleanup.js';
import { AUTH_CLEANUP_JOB, closeMaintenanceQueue, MAINTENANCE_QUEUE, scheduleAuthCleanup } from '@/jobs/maintenance.queue.js';
import { logger } from '@/lib/logger.js';
import { prisma } from '@/lib/prisma.js';
import { closeRedis, queueOptions } from '@/lib/redis.js';
import { processEmailJob } from '@/modules/email/email.processor.js';
import { EMAIL_QUEUE, type EmailJob } from '@/modules/email/email.queue.js';

/**
 * Background worker: delivers queued emails and runs scheduled maintenance.
 * Runs as its own process (`pnpm --filter api dev:worker`, or `node dist/worker.js` in production)
 * so slow providers and long jobs never block API requests. Scale it independently of the API.
 */

const emailWorker = new Worker<EmailJob>(EMAIL_QUEUE, processEmailJob, { ...queueOptions(), concurrency: 5 });

const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE,
  async (job) => {
    if (job.name !== AUTH_CLEANUP_JOB) {
      throw new Error(`Unknown maintenance job: ${job.name}`);
    }
    return cleanupExpiredAuthData();
  },
  { ...queueOptions(), concurrency: 1 },
);

for (const worker of [emailWorker, maintenanceWorker]) {
  worker.on('completed', (job, result) => {
    if (job.queueName === MAINTENANCE_QUEUE) logger.info({ job: job.name, result }, 'maintenance job complete');
  });
  worker.on('failed', (job, error) => {
    logger.error({ err: error, queue: worker.name, job: job?.name, jobId: job?.id, attempts: job?.attemptsMade }, 'job failed');
  });
  worker.on('error', (error) => logger.error({ err: error, queue: worker.name }, 'worker error'));
}

await scheduleAuthCleanup();
logger.info({ queues: [EMAIL_QUEUE, MAINTENANCE_QUEUE], prefix: queueOptions().prefix, cleanupCron: env.CLEANUP_CRON }, 'worker started');

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'worker shutdown started');
  // Force exit if an in-flight job doesn't finish in time; BullMQ will retry it on another worker.
  setTimeout(() => process.exit(1), 15_000).unref();

  try {
    // close() waits for active jobs to finish before resolving.
    await Promise.all([emailWorker.close(), maintenanceWorker.close()]);
    await closeMaintenanceQueue();
    await Promise.all([prisma.$disconnect(), closeRedis()]);
    logger.info('worker shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, 'worker shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  void shutdown('uncaughtException', 1);
});
