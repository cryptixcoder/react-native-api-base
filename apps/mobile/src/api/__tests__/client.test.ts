import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { api, refreshClient } from '@/api/client';
import { onSessionExpired } from '@/auth/auth-events';
import { seedTokens, storedTokens } from '@/test/secure-store';

/**
 * Exercises the real interceptors with fake axios adapters (no network): one adapter for app
 * requests and one for the refresh call.
 */
function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> {
  const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };

  if (status >= 400) {
    return Promise.reject(new AxiosError(`Request failed with status ${status}`, undefined, config, undefined, response));
  }

  return Promise.resolve(response);
}

const authHeader = (config: InternalAxiosRequestConfig) => AxiosHeaders.from(config.headers).get('Authorization');

let apiAdapter: jest.MockedFunction<AxiosAdapter>;
let refreshAdapter: jest.MockedFunction<AxiosAdapter>;

beforeEach(() => {
  apiAdapter = jest.fn();
  refreshAdapter = jest.fn();
  api.defaults.adapter = apiAdapter;
  refreshClient.defaults.adapter = refreshAdapter;
});

/** API that accepts only the given access token and 401s anything else. */
function acceptOnly(validToken: string) {
  apiAdapter.mockImplementation((config) =>
    authHeader(config) === `Bearer ${validToken}` ? respond(config, 200, { ok: true }) : respond(config, 401, { error: { code: 'INVALID_ACCESS_TOKEN' } }),
  );
}

function refreshSucceeds() {
  refreshAdapter.mockImplementation((config) =>
    respond(config, 200, { accessToken: 'fresh-access', refreshToken: 'fresh-refresh', user: { id: 'user-123' } }),
  );
}

describe('api client', () => {
  it('attaches the stored access token', async () => {
    seedTokens({ accessToken: 'valid-access' });
    acceptOnly('valid-access');

    await api.get('/things');

    expect(authHeader(apiAdapter.mock.calls[0]![0])).toBe('Bearer valid-access');
    expect(refreshAdapter).not.toHaveBeenCalled();
  });

  it('refreshes on 401, stores the rotated tokens and retries the request', async () => {
    seedTokens({ accessToken: 'expired-access', refreshToken: 'old-refresh' });
    acceptOnly('fresh-access');
    refreshSucceeds();

    const response = await api.get('/things');

    expect(response.data).toEqual({ ok: true });
    expect(JSON.parse(refreshAdapter.mock.calls[0]![0].data)).toEqual({ refreshToken: 'old-refresh' });
    expect(storedTokens()).toEqual({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
    expect(apiAdapter).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh between concurrent 401s', async () => {
    seedTokens({ accessToken: 'expired-access' });
    acceptOnly('fresh-access');
    refreshSucceeds();

    const responses = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
  });

  it('clears tokens and emits session-expired when the refresh token is rejected', async () => {
    seedTokens({ accessToken: 'expired-access' });
    acceptOnly('fresh-access');
    refreshAdapter.mockImplementation((config) => respond(config, 401, { error: { code: 'INVALID_REFRESH_TOKEN' } }));
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(api.get('/things')).rejects.toThrow();

    expect(storedTokens()).toEqual({ accessToken: null, refreshToken: null });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('keeps the session when the refresh fails for a network reason', async () => {
    seedTokens({ accessToken: 'expired-access', refreshToken: 'old-refresh' });
    acceptOnly('fresh-access');
    refreshAdapter.mockImplementation((config) => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config)));
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(api.get('/things')).rejects.toThrow('Network Error');

    expect(storedTokens().refreshToken).toBe('old-refresh');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not retry the same request twice', async () => {
    seedTokens({ accessToken: 'expired-access' });
    apiAdapter.mockImplementation((config) => respond(config, 401, {}));
    refreshSucceeds();

    await expect(api.get('/things')).rejects.toThrow('401');

    expect(apiAdapter).toHaveBeenCalledTimes(2);
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
  });

  it('passes non-401 errors through untouched', async () => {
    seedTokens();
    apiAdapter.mockImplementation((config) => respond(config, 500, {}));

    await expect(api.get('/things')).rejects.toThrow('500');
    expect(refreshAdapter).not.toHaveBeenCalled();
  });
});
