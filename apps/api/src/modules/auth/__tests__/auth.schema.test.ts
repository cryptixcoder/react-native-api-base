import { emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema } from '@/modules/auth/auth.schema.js';

describe('auth schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid input and normalizes the email', () => {
      const result = registerSchema.parse({
        email: '  User@Example.COM ',
        password: 'Secure-password-123',
        firstName: ' Test ',
        lastName: 'User',
      });

      expect(result).toEqual({ email: 'user@example.com', password: 'Secure-password-123', firstName: 'Test', lastName: 'User' });
    });

    it('allows names to be omitted', () => {
      expect(registerSchema.safeParse({ email: 'user@example.com', password: 'Secure-password-123' }).success).toBe(true);
    });

    it('rejects an invalid email', () => {
      expect(registerSchema.safeParse({ email: 'not-an-email', password: 'Secure-password-123' }).success).toBe(false);
    });

    it('rejects passwords shorter than 8 characters', () => {
      const result = registerSchema.safeParse({ email: 'user@example.com', password: 'short' });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('Password must be at least 8 characters');
    });

    it('rejects passwords longer than 128 characters', () => {
      expect(registerSchema.safeParse({ email: 'user@example.com', password: 'a'.repeat(129) }).success).toBe(false);
    });

    it('rejects missing fields', () => {
      expect(registerSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('does not apply the password policy so existing users can always log in', () => {
      expect(loginSchema.safeParse({ email: 'user@example.com', password: 'short' }).success).toBe(true);
    });

    it('rejects an empty password', () => {
      expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('accepts a token and a valid password', () => {
      expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'New-password-123' }).success).toBe(true);
    });

    it('applies the password policy', () => {
      expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'short' }).success).toBe(false);
    });

    it('requires a token', () => {
      expect(resetPasswordSchema.safeParse({ token: '', password: 'New-password-123' }).success).toBe(false);
    });
  });

  it('emailOnlySchema normalizes the email', () => {
    expect(emailOnlySchema.parse({ email: 'USER@example.com' })).toEqual({ email: 'user@example.com' });
  });
});
