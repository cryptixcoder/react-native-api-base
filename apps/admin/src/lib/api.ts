import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { toApiError } from '@/lib/api-error';
import { API_URL } from '@/lib/env';
import { ACCESS_COOKIE, ADMIN_CLIENT_HEADERS } from '@/lib/session';

type Query = Record<string, string | number | undefined | null>;

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
}

/**
 * Call the Express API as the signed-in admin. Server-only: reads the access token from the httpOnly
 * cookie (kept fresh by src/proxy.ts). Responses are never cached, so every render shows live data.
 * A 401 means the session is gone, so it redirects to the login page; other errors throw ApiError.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const url = new URL(`${API_URL}${path}`);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...ADMIN_CLIENT_HEADERS,
      ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      ...(options.body !== undefined && { 'content-type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (response.status === 401) {
    redirect('/login?reason=expired');
  }

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  return body as T;
}

/** Unwrap `{ data }` responses. */
export async function apiData<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  return (await apiFetch<{ data: T }>(path, options)).data;
}
