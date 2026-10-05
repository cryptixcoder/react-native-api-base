import { env } from '@config/env.js';
import { logger } from '@/lib/logger.js';
import { resend } from '@/lib/resend.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Logged instead of sending when no Resend key is configured (development only). */
  devLink: string;
}

async function sendEmail({ to, subject, html, devLink }: SendEmailParams): Promise<void> {
  if (!resend) {
    logger.warn({ to, subject, link: devLink }, 'RESEND_API_KEY not set; email not sent');
    return;
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject,
    html,
  });

  if (error) {
    logger.error({ err: error, subject }, 'Resend email error');
    throw new Error('Failed to send email');
  }
}

/**
 * Build a link that opens the mobile app. MOBILE_APP_URL is a custom scheme (myapp://) in development
 * and should be a universal/app link (https://app.example.com/) in production.
 */
function appLink(path: string, token: string): string {
  const base = env.MOBILE_APP_URL.endsWith('/') ? env.MOBILE_APP_URL : `${env.MOBILE_APP_URL}/`;
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function layout(body: string): string {
  return `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif;">${body}</body></html>`;
}

function button(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">${label}</a></p>`;
}

export async function sendVerificationEmail(params: { to: string; firstName?: string | null; token: string }): Promise<void> {
  const url = appLink('verify-email', params.token);
  const name = escapeHtml(params.firstName || 'there');

  await sendEmail({
    to: params.to,
    subject: 'Verify your email address',
    devLink: url,
    html: layout(`
      <h2>Welcome, ${name}!</h2>
      <p>Please verify your email address to activate your account.</p>
      ${button(url, 'Verify Email')}
      <p>This link expires in ${env.EMAIL_VERIFICATION_EXPIRES_IN_HOURS} hours.</p>
    `),
  });
}

export async function sendPasswordResetEmail(params: { to: string; firstName?: string | null; token: string }): Promise<void> {
  const url = appLink('reset-password', params.token);
  const name = escapeHtml(params.firstName || 'there');

  await sendEmail({
    to: params.to,
    subject: 'Reset your password',
    devLink: url,
    html: layout(`
      <h2>Password reset</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password.</p>
      ${button(url, 'Reset Password')}
      <p>This link expires in ${env.PASSWORD_RESET_EXPIRES_IN_MINUTES} minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `),
  });
}

/**
 * Escape user-controlled values interpolated into HTML email templates.
 */
export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
