import { create, isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { notifySessionExpired } from '@/auth/auth-events';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/auth/auth.storage';
import type { AuthResponse } from '@/types/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not configured. Copy apps/mobile/.env.example to apps/mobile/.env.');
}

const clientConfig = {
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
};

/** Client for all app requests. Attaches the access token and transparently refreshes it on 401. */
export const api = create(clientConfig);

/** Bare client used only for the refresh call, so it never re-enters the interceptors below. */
export const refreshClient = create(clientConfig);

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

class NoRefreshTokenError extends Error {}

/**
 * Shared in-flight refresh. Refresh tokens rotate on every use, so concurrent 401s must wait
 * for one refresh instead of each spending (and invalidating) the same token.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    throw new NoRefreshTokenError('No refresh token available');
  }

  const { data } = await refreshClient.post<AuthResponse>('/auth/refresh', { refreshToken });

  await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

  return data.accessToken;
}

/** True when the server rejected the session itself, as opposed to a network or server failure. */
function isSessionRejected(error: unknown): boolean {
  if (error instanceof NoRefreshTokenError) return true;
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status === 401 || status === 403;
}

api.interceptors.request.use(async (config) => {
  const accessToken = await getAccessToken();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const accessToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      // Only sign out when the session is truly invalid; a flaky network should not log the user out.
      if (isSessionRejected(refreshError)) {
        await clearTokens();
        notifySessionExpired();
      }

      throw refreshError;
    }
  },
);
