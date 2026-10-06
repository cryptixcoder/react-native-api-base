import type { Request, Response } from 'express';
import { getAuthUser } from '@/middleware/auth.middleware.js';
import * as authService from '@/modules/auth/auth.service.js';
import type { LoginInput, RegisterInput } from '@/modules/auth/auth.schema.js';
import { parseClientInfo, trackActivity } from '@/modules/activity/activity.service.js';
import type { RequestContext } from '@/modules/auth/auth.types.js';

// Request bodies below have already been parsed by the validate() middleware in auth.routes.ts.
// Successful sign-ins, refreshes and /me calls also record the user as active today (for analytics).

function getRequestMetadata(req: Request): RequestContext {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
    client: parseClientInfo({ platform: req.get('x-client-platform'), appVersion: req.get('x-app-version') }),
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const metadata = getRequestMetadata(req);
  const result = await authService.register(req.body as RegisterInput, metadata);
  trackActivity(result.user.id, metadata.client);

  res.status(201).json({ message: 'Registration successful', ...result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const metadata = getRequestMetadata(req);
  const result = await authService.login(req.body as LoginInput, metadata);
  trackActivity(result.user.id, metadata.client);

  res.status(200).json({ message: 'Login successful', ...result });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string };

  const metadata = getRequestMetadata(req);
  const result = await authService.refreshSession({ refreshToken, ...metadata });
  trackActivity(result.user.id, metadata.client);

  res.status(200).json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string };

  await authService.logout(refreshToken);

  res.status(200).json({ message: 'Logged out successfully' });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  await authService.logoutAllDevices(getAuthUser(req).id);

  res.status(200).json({ message: 'Logged out from all devices' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getCurrentUser(getAuthUser(req).id);
  trackActivity(user.id, getRequestMetadata(req).client);

  res.status(200).json({ user });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };

  await authService.forgotPassword(email);

  // Same response whether or not the account exists.
  res.status(200).json({ message: 'If an account exists for this email, a password reset link has been sent.' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };

  await authService.resetPassword({ token, newPassword: password });

  res.status(200).json({ message: 'Password reset successful. Please log in again.' });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token: string };

  const user = await authService.verifyEmail(token);

  res.status(200).json({ message: 'Email verified successfully', user });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };

  await authService.resendVerification(email);

  res.status(200).json({ message: 'If your account needs verification, a new link has been sent.' });
}
