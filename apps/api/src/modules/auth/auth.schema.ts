import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(320));

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

// Login only requires a non-empty password so policy changes never lock out existing users.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const emailOnlySchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
