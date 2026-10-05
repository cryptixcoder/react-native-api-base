import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { AuthProvider } from '@/auth/auth-context';
import type { User } from '@/types/auth';

/** A fresh client per test: no retries, no cross-test cache. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

export function createProviders(queryClient = createTestQueryClient()) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }

  return { queryClient, Providers };
}

export async function renderWithProviders(ui: ReactElement, queryClient?: QueryClient) {
  const { Providers, queryClient: client } = createProviders(queryClient);
  const result = await render(ui, { wrapper: Providers });
  return { ...result, queryClient: client };
}

export async function renderHookWithProviders<T>(hook: () => T, queryClient?: QueryClient) {
  const { Providers, queryClient: client } = createProviders(queryClient);
  const result = await renderHook(hook, { wrapper: Providers });
  return { ...result, queryClient: client };
}

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    status: 'ACTIVE',
    emailVerifiedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildAuthResponse(overrides: Partial<User> = {}) {
  return { user: buildUser(overrides), accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
}
