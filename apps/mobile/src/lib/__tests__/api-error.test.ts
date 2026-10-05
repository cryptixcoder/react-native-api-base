import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { getErrorCode, getErrorMessage } from '@/lib/api-error';

function apiError(status: number, data: unknown): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  return new AxiosError('failed', undefined, config, undefined, { status, data, statusText: '', headers: {}, config } as AxiosResponse);
}

describe('api error helpers', () => {
  it('uses the API error message', () => {
    const error = apiError(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });

    expect(getErrorMessage(error)).toBe('Invalid email or password');
    expect(getErrorCode(error)).toBe('INVALID_CREDENTIALS');
  });

  it('surfaces the first field error for validation failures', () => {
    const error = apiError(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: { fieldErrors: { password: ['Password must be at least 8 characters'] } } },
    });

    expect(getErrorMessage(error)).toBe('Password must be at least 8 characters');
  });

  it('explains network failures', () => {
    expect(getErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toMatch(/Unable to reach the server/);
  });

  it('falls back for unknown errors', () => {
    expect(getErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});
