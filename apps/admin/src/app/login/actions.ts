'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { toApiError } from '@/lib/api-error';
import { API_URL } from '@/lib/env';
import { ADMIN_CLIENT_HEADERS, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '@/lib/session';

export type LoginState = { error: string; email: string } | undefined;

/** Only allow redirects back to paths on this site. */
function safeRedirectPath(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.', email };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...ADMIN_CLIENT_HEADERS },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Unable to reach the API. Check that it is running and API_URL is correct.', email };
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return { error: toApiError(response.status, body).message, email };
  }

  const session = body as { accessToken: string; refreshToken: string; user: { role: string } };

  if (session.user.role !== 'ADMIN') {
    // Don't leave a session behind for an account that can't use the panel.
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...ADMIN_CLIENT_HEADERS },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
    return { error: 'This account does not have admin access.', email };
  }

  setSessionCookies(await cookies(), session);
  redirect(safeRedirectPath(formData.get('from')));
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...ADMIN_CLIENT_HEADERS },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  clearSessionCookies(cookieStore);
  redirect('/login');
}
