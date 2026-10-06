/**
 * Read a JWT's expiry without verifying it. Only used to decide when to refresh; the API verifies
 * every token itself.
 */
export function getTokenExpiry(token: string | undefined): number | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;

  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, unreadable, or expires within `skewMs`. */
export function needsRefresh(token: string | undefined, now = Date.now(), skewMs = 60_000): boolean {
  const expiry = getTokenExpiry(token);
  return expiry === null || expiry - now <= skewMs;
}
