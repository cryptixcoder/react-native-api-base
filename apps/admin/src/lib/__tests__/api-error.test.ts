import { ApiError, errorMessage, toApiError } from '@/lib/api-error';

describe('API errors', () => {
  it('maps the API error envelope', () => {
    const error = toApiError(409, { error: { code: 'CANNOT_MODIFY_SELF', message: 'You cannot perform this action on your own account' } });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CANNOT_MODIFY_SELF' });
    expect(errorMessage(error)).toBe('You cannot perform this action on your own account');
  });

  it('surfaces the first field error for validation failures', () => {
    const error = toApiError(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: { fieldErrors: { reason: ['Give a reason of at least 3 characters'] } } } });

    expect(error.message).toBe('Give a reason of at least 3 characters');
  });

  it('copes with non-JSON error bodies', () => {
    expect(toApiError(502, null)).toMatchObject({ code: 'UNKNOWN_ERROR', message: 'Request failed (502)' });
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
