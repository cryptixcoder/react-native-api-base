import type { Job } from 'bullmq';
import { env } from '@config/env.js';
import { logger } from '@/lib/logger.js';
import { resend } from '@/lib/resend.js';
import type { EmailJob } from '@/modules/email/email.queue.js';
import { renderPasswordResetEmail, renderVerificationEmail, type RenderedEmail } from '@/modules/email/email.templates.js';

function render(data: EmailJob): RenderedEmail {
  switch (data.type) {
    case 'verify-email':
      return renderVerificationEmail(data);
    case 'password-reset':
      return renderPasswordResetEmail(data);
  }
}

/**
 * Deliver one queued email. Throwing makes BullMQ retry the job with backoff.
 */
export async function processEmailJob(job: Pick<Job<EmailJob>, 'id' | 'data' | 'attemptsMade'>): Promise<void> {
  const email = render(job.data);

  if (!resend) {
    logger.warn({ jobId: job.id, to: job.data.to, subject: email.subject, link: email.link }, 'RESEND_API_KEY not set; email not sent');
    return;
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [job.data.to],
    subject: email.subject,
    html: email.html,
  });

  if (error) {
    throw new Error(`Resend rejected email (${job.data.type}): ${error.message}`);
  }

  logger.info({ jobId: job.id, type: job.data.type, attempt: job.attemptsMade + 1 }, 'email sent');
}
