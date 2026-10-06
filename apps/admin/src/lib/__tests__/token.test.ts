import { getTokenExpiry, needsRefresh } from '@/lib/token';

const jwt = (payload: object) => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

describe('token expiry', () => {
  const now = Date.parse('2026-06-15T12:00:00Z');

  it('reads the exp claim', () => {
    expect(getTokenExpiry(jwt({ exp: now / 1000 + 600 }))).toBe(now + 600_000);
  });

  it('refreshes tokens that are missing, malformed or about to expire', () => {
    expect(needsRefresh(undefined, now)).toBe(true);
    expect(needsRefresh('not-a-jwt', now)).toBe(true);
    expect(needsRefresh(jwt({ exp: now / 1000 + 30 }), now)).toBe(true);
    expect(needsRefresh(jwt({ exp: now / 1000 + 600 }), now)).toBe(false);
  });
});
