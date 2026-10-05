import { api } from '@/api/client';
import type { AuthResponse, LoginInput, MessageResponse, RegisterInput, User } from '@/types/auth';

// Plain request functions. Components use them through the React Query hooks in src/auth/.

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', input);
  return data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', input);
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}

export async function logoutAllDevices(): Promise<void> {
  await api.post('/auth/logout-all');
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(input: { token: string; password: string }): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/reset-password', input);
  return data;
}

export async function verifyEmail(token: string): Promise<User> {
  const { data } = await api.post<{ user: User }>('/auth/verify-email', { token });
  return data.user;
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/resend-verification', { email });
  return data;
}
