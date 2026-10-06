/** An error response from the Express API ({ error: { code, message } }). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[] | undefined> } };
}

export function toApiError(status: number, body: unknown): ApiError {
  const error = (body as ErrorBody | null)?.error;
  const firstFieldError = Object.values(error?.details?.fieldErrors ?? {}).flat()[0];
  const message = error?.code === 'VALIDATION_ERROR' && firstFieldError ? firstFieldError : (error?.message ?? `Request failed (${status})`);
  return new ApiError(status, error?.code ?? 'UNKNOWN_ERROR', message);
}

/** A user-facing message for anything thrown by an API call. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
