import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, ADMIN_CLIENT_HEADERS, REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from '@/lib/session';
import { needsRefresh } from '@/lib/token';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

/**
 * Keeps the admin session alive and sends signed-out visitors to /login.
 *
 * Before a page renders (or a server action runs), an access token that is missing or about to expire
 * is exchanged for a new token pair using the refresh cookie. The new tokens are written to the
 * response and forwarded on the request, so the render that follows already uses them.
 *
 * Authorization is NOT decided here: pages and server actions call requireAdmin() (src/lib/auth.ts).
 */
export async function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return redirectToLogin(request);
  }

  if (!needsRefresh(request.cookies.get(ACCESS_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const result = await refreshOnce(refreshToken);

  if (result === 'rejected') {
    const redirect = redirectToLogin(request, 'expired');
    clearSessionCookies(redirect.cookies);
    return redirect;
  }

  if (result === 'unavailable') {
    // API unreachable or erroring: render the page (it shows an error state) instead of signing the admin out.
    return NextResponse.next();
  }

  const tokens = result;

  // Forward the new tokens to this request's render, and persist them in the browser.
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const next = NextResponse.next({ request: { headers: request.headers } });
  setSessionCookies(next.cookies, tokens);
  return next;
}

type Tokens = { accessToken: string; refreshToken: string };
type RefreshResult = Tokens | 'rejected' | 'unavailable';

/**
 * Refresh tokens rotate on every use, so parallel requests (several tabs, prefetches) holding the same
 * refresh token must share one refresh: the second caller would otherwise be rejected and signed out.
 * Results are kept briefly so requests arriving just after the refresh reuse the new pair.
 */
const refreshes = new Map<string, { result: Promise<RefreshResult>; expiresAt: number }>();
const SHARE_REFRESH_MS = 30_000;

function refreshOnce(refreshToken: string): Promise<RefreshResult> {
  const now = Date.now();
  for (const [key, entry] of refreshes) if (entry.expiresAt <= now) refreshes.delete(key);

  const existing = refreshes.get(refreshToken);
  if (existing) return existing.result;

  const result = requestRefresh(refreshToken);
  refreshes.set(refreshToken, { result, expiresAt: now + SHARE_REFRESH_MS });
  return result;
}

async function requestRefresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...ADMIN_CLIENT_HEADERS },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) return 'rejected';
    if (!response.ok) return 'unavailable';

    const { accessToken, refreshToken: rotated } = (await response.json()) as Tokens;
    return { accessToken, refreshToken: rotated };
  } catch {
    return 'unavailable';
  }
}

function redirectToLogin(request: NextRequest, reason?: string): NextResponse {
  const url = new URL('/login', request.url);
  const from = request.nextUrl.pathname + request.nextUrl.search;
  if (from !== '/') url.searchParams.set('from', from);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, Next internals and static brand assets.
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
