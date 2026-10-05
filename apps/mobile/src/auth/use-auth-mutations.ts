import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as authApi from '@/api/auth.api';
import { authKeys, useAuth } from '@/auth/auth-context';
import { getRefreshToken } from '@/auth/auth.storage';
import type { LoginInput, RegisterInput, User } from '@/types/auth';

// mutationFns wrap the API calls explicitly: React Query passes a second (context) argument we don't want forwarded.

export function useLogin() {
  const { startSession } = useAuth();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: startSession,
  });
}

export function useRegister() {
  const { startSession } = useAuth();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: startSession,
  });
}

export function useLogout() {
  const { endSession } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const refreshToken = await getRefreshToken();
      if (refreshToken) await authApi.logout(refreshToken);
    },
    // Always sign out locally, even if the server could not be reached.
    onSettled: endSession,
  });
}

export function useLogoutAllDevices() {
  const { endSession } = useAuth();

  return useMutation({
    mutationFn: () => authApi.logoutAllDevices(),
    onSettled: endSession,
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (input: { token: string; password: string }) => authApi.resetPassword(input) });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: (user: User) => {
      // Only update the cache if this device is signed in as the verified user.
      queryClient.setQueryData<User>(authKeys.me, (current) => (current?.id === user.id ? user : current));
    },
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: (email: string) => authApi.resendVerification(email) });
}
