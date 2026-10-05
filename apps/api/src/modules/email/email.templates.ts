import { env } from '@config/env.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  /** The primary link in the email; logged instead of sending when Resend isn't configured. */
  link: string;
}

interface TokenEmailParams {
  firstName?: string | null;
  token: string;
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
  return `<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">${label}</a></p>`;
}

export function renderVerificationEmail({ firstName, token }: TokenEmailParams): RenderedEmail {
  const link = appLink('verify-email', token);
  const name = escapeHtml(firstName || 'there');

  return {
    subject: 'Verify your email address',
    link,
    html: layout(`
      <h2>Welcome, ${name}!</h2>
      <p>Please verify your email address to activate your account.</p>
      ${button(link, 'Verify Email')}
      <p>This link expires in ${env.EMAIL_VERIFICATION_EXPIRES_IN_HOURS} hours.</p>
    `),
  };
}

export function renderPasswordResetEmail({ firstName, token }: TokenEmailParams): RenderedEmail {
  const link = appLink('reset-password', token);
  const name = escapeHtml(firstName || 'there');

  return {
    subject: 'Reset your password',
    link,
    html: layout(`
      <h2>Password reset</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password.</p>
      ${button(link, 'Reset Password')}
      <p>This link expires in ${env.PASSWORD_RESET_EXPIRES_IN_MINUTES} minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `),
  };
}

/**
 * Escape user-controlled values interpolated into HTML email templates.
 */
export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
