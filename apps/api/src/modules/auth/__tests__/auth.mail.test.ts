import { jest } from '@jest/globals';
import type { EmailJob } from '@/modules/email/email.queue.js';

const enqueueEmail = jest.fn<(job: EmailJob) => Promise<void>>(async () => undefined);
jest.unstable_mockModule('@/modules/email/email.queue.js', () => ({ enqueueEmail }));

const { sendPasswordResetEmail, sendVerificationEmail } = await import('@/modules/auth/auth.mail.js');

describe('auth mail', () => {
  it('queues verification emails', async () => {
    await sendVerificationEmail({ to: 'user@example.com', firstName: 'Test', token: 'verify-token' });

    expect(enqueueEmail).toHaveBeenCalledWith({ type: 'verify-email', to: 'user@example.com', firstName: 'Test', token: 'verify-token' });
  });

  it('queues password reset emails', async () => {
    await sendPasswordResetEmail({ to: 'user@example.com', token: 'reset-token' });

    expect(enqueueEmail).toHaveBeenCalledWith({ type: 'password-reset', to: 'user@example.com', token: 'reset-token' });
  });

  it('propagates queue failures so callers can log them', async () => {
    enqueueEmail.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(sendVerificationEmail({ to: 'user@example.com', token: 't' })).rejects.toThrow('Redis unavailable');
  });
});
