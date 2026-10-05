import { escapeHtml, renderPasswordResetEmail, renderVerificationEmail } from '@/modules/email/email.templates.js';

describe('email templates', () => {
  it('links verification emails into the app with the encoded token', () => {
    const email = renderVerificationEmail({ firstName: 'Test', token: 'abc 123' });

    expect(email.subject).toBe('Verify your email address');
    expect(email.link).toBe('myapp://verify-email?token=abc%20123');
    expect(email.html).toContain('href="myapp://verify-email?token=abc%20123"');
    expect(email.html).toContain('Welcome, Test!');
    expect(email.html).toContain('expires in 24 hours');
  });

  it('links password reset emails into the app', () => {
    const email = renderPasswordResetEmail({ firstName: null, token: 'reset-token' });

    expect(email.subject).toBe('Reset your password');
    expect(email.link).toBe('myapp://reset-password?token=reset-token');
    expect(email.html).toContain('Hi there,');
    expect(email.html).toContain('expires in 30 minutes');
  });

  it('escapes user-controlled names', () => {
    const email = renderVerificationEmail({ firstName: '<script>alert("x")</script>', token: 't' });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('escapeHtml covers quotes and ampersands', () => {
    expect(escapeHtml(`a & b's "c"`)).toBe('a &amp; b&#039;s &quot;c&quot;');
  });
});
