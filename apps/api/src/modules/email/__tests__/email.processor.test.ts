import { jest } from '@jest/globals';
import type { EmailJob } from '@/modules/email/email.queue.js';

type SendResult = { data: { id: string } | null; error: { message: string } | null };

const send = jest.fn<(payload: { from: string; to: string[]; subject: string; html: string }) => Promise<SendResult>>();
jest.unstable_mockModule('@/lib/resend.js', () => ({ resend: { emails: { send } } }));

const { processEmailJob } = await import('@/modules/email/email.processor.js');

const job = (data: EmailJob) => ({ id: 'job-1', data, attemptsMade: 0 });

describe('processEmailJob', () => {
  it('sends the rendered email through Resend', async () => {
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await processEmailJob(job({ type: 'password-reset', to: 'user@example.com', firstName: 'Test', token: 'reset-token' }));

    expect(send).toHaveBeenCalledWith({
      from: 'Test <test@example.com>',
      to: ['user@example.com'],
      subject: 'Reset your password',
      html: expect.stringContaining('myapp://reset-password?token=reset-token'),
    });
  });

  it('throws when Resend rejects the email so BullMQ retries it', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'rate limited' } });

    await expect(processEmailJob(job({ type: 'verify-email', to: 'user@example.com', token: 't' }))).rejects.toThrow('rate limited');
  });

  it('skips sending without a Resend API key (development)', async () => {
    // ESM mocks are fixed at import time, so load a fresh copy of the processor with no Resend client.
    jest.resetModules();
    jest.unstable_mockModule('@/lib/resend.js', () => ({ resend: null }));
    const { processEmailJob: processWithoutResend } = await import('@/modules/email/email.processor.js');

    await expect(processWithoutResend(job({ type: 'verify-email', to: 'user@example.com', token: 't' }))).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
