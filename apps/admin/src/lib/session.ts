/**
 * Session cookies. Tokens live only in httpOnly cookies: browser JavaScript can never read them.
 * Shared by the proxy (token refresh) and server actions (login/logout).
 */
export const ACCESS_COOKIE = 'admin_access';
export const REFRESH_COOKIE = 'admin_refresh';

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

interface CookieSetter {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
}

interface CookieDeleter {
  delete(name: string): unknown;
}

const baseOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

export function setSessionCookies(cookies: CookieSetter, tokens: { accessToken: string; refreshToken: string }): void {
  cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(), maxAge: ACCESS_MAX_AGE });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...baseOptions(), maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(cookies: CookieDeleter): void {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
}

/** Sent with every API request so the admin panel's own traffic is excluded from product analytics. */
export const ADMIN_CLIENT_HEADERS = { 'x-client-platform': 'admin' } as const;
