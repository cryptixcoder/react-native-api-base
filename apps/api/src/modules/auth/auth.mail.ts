import { enqueueEmail } from '@/modules/email/email.queue.js';

// Auth emails are queued and delivered (with retries) by the worker process; see src/worker.ts.

export async function sendVerificationEmail(params: { to: string; firstName?: string | null; token: string }): Promise<void> {
  await enqueueEmail({ type: 'verify-email', ...params });
}

export async function sendPasswordResetEmail(params: { to: string; firstName?: string | null; token: string }): Promise<void> {
  await enqueueEmail({ type: 'password-reset', ...params });
}
