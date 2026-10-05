import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth.api';
import { onSessionExpired } from '@/auth/auth-events';
import { clearTokens, getRefreshToken, saveTokens } from '@/auth/auth.storage';
import type { AuthResponse, User } from '@/types/auth';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

interface AuthContextValue {
  user: User | null;
  /** True until stored tokens have been checked and, if present, the user has been restored. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Persist tokens and seed the current user (after login / register). */
  startSession: (result: AuthResponse) => Promise<void>;
  /** Forget tokens and all cached server data (after logout / session expiry). */
  endSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the signed-in state. The current user is a React Query query (`authKeys.me`), so screens can
 * read or refetch it like any other server data; this provider only tracks whether tokens exist.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // null = not yet read from SecureStore.
  const [hasTokens, setHasTokens] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    getRefreshToken()
      .then((token) => !cancelled && setHasTokens(Boolean(token)))
      .catch(() => !cancelled && setHasTokens(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: () => authApi.getCurrentUser(),
    enabled: hasTokens === true,
    staleTime: 5 * 60_000,
  });

  const startSession = useCallback(
    async (result: AuthResponse) => {
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      queryClient.setQueryData(authKeys.me, result.user);
      setHasTokens(true);
    },
    [queryClient],
  );

  const endSession = useCallback(async () => {
    await clearTokens();
    setHasTokens(false);
    queryClient.clear();
  }, [queryClient]);

  // The API client clears tokens and emits this when a refresh is rejected.
  useEffect(
    () =>
      onSessionExpired(() => {
        setHasTokens(false);
        queryClient.clear();
      }),
    [queryClient],
  );

  const user = hasTokens ? (meQuery.data ?? null) : null;
  const isLoading = hasTokens === null || (hasTokens && meQuery.isPending && meQuery.fetchStatus !== 'idle');

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: user !== null, startSession, endSession }),
    [user, isLoading, startSession, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
