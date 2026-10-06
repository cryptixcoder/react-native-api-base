/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const jwt = (expiresInSeconds: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds })).toString('base64url')}.s`;

function request(path: string, cookies: Record<string, string>) {
  return new NextRequest(`http://localhost:3001${path}`, {
    headers: { cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ') },
  });
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('proxy (admin session)', () => {
  it('sends visitors without a session to the login page, remembering where they were going', async () => {
    const response = await proxy(request('/users?status=SUSPENDED', {}));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3001/login?from=%2Fusers%3Fstatus%3DSUSPENDED');
  });

  it('lets requests with a fresh access token through without calling the API', async () => {
    const response = await proxy(request('/', { admin_access: jwt(600), admin_refresh: 'refresh-fresh' }));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expiring access token and stores the rotated pair', async () => {
    fetchMock.mockResolvedValue(Response.json({ accessToken: 'new-access', refreshToken: 'new-refresh' }));

    const response = await proxy(request('/', { admin_access: jwt(10), admin_refresh: 'refresh-expiring' }));

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/v1/auth/refresh', expect.objectContaining({ method: 'POST', body: JSON.stringify({ refreshToken: 'refresh-expiring' }) }));
    expect(response.cookies.get('admin_access')).toMatchObject({ value: 'new-access', httpOnly: true });
    expect(response.cookies.get('admin_refresh')).toMatchObject({ value: 'new-refresh', httpOnly: true });
  });

  it('shares one refresh between concurrent requests (refresh tokens rotate)', async () => {
    fetchMock.mockResolvedValue(Response.json({ accessToken: 'shared-access', refreshToken: 'shared-refresh' }));
    const cookies = { admin_refresh: 'refresh-concurrent' };

    const responses = await Promise.all([proxy(request('/', cookies)), proxy(request('/users', cookies)), proxy(request('/audit-log', cookies))]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const response of responses) expect(response.cookies.get('admin_access')?.value).toBe('shared-access');
  });

  it('signs the admin out when the refresh token is rejected', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: 'INVALID_REFRESH_TOKEN' } }, { status: 401 }));

    const response = await proxy(request('/users', { admin_refresh: 'refresh-revoked' }));

    expect(response.headers.get('location')).toBe('http://localhost:3001/login?from=%2Fusers&reason=expired');
    expect(response.cookies.get('admin_refresh')?.value).toBe('');
  });

  it('keeps the session when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const response = await proxy(request('/', { admin_refresh: 'refresh-offline' }));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
