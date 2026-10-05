import { Queue, type JobsOptions } from 'bullmq';
import { queueOptions } from '@/lib/redis.js';

export const EMAIL_QUEUE = 'email';

export type EmailJob =
  | { type: 'verify-email'; to: string; firstName?: string | null; token: string }
  | { type: 'password-reset'; to: string; firstName?: string | null; token: string };

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  // Job data contains single-use tokens: drop it as soon as it's delivered and keep failures only briefly.
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

let queue: Queue<EmailJob> | null = null;

function getEmailQueue(): Queue<EmailJob> {
  queue ??= new Queue<EmailJob>(EMAIL_QUEUE, { ...queueOptions(), defaultJobOptions });
  return queue;
}

/**
 * Queue an email for delivery by the worker (src/worker.ts). Resolves once the job is stored in Redis.
 */
export async function enqueueEmail(job: EmailJob): Promise<void> {
  await getEmailQueue().add(job.type, job);
}

export async function closeEmailQueue(): Promise<void> {
  if (!queue) return;
  const current = queue;
  queue = null;
  await current.close();
}
