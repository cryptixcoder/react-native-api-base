import { focusManager, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AppState, Platform } from 'react-native';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Retry network and 5xx failures, never 4xx (the request itself is wrong or unauthorized).
        retry: (failureCount, error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          if (status !== undefined && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * React Native has no window focus events; refetch stale queries when the app returns to the foreground.
 * Returns an unsubscribe function.
 */
export function subscribeAppStateFocus(): () => void {
  if (Platform.OS === 'web') return () => {};

  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });

  return () => subscription.remove();
}
