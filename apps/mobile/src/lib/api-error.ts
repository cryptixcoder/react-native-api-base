import { isAxiosError } from 'axios';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { fieldErrors?: Record<string, string[] | undefined> };
  };
}

/** Error code from the API's `{ error: { code } }` envelope, if present. */
export function getErrorCode(error: unknown): string | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error?.code : undefined;
}

/** A user-facing message for any error thrown by the API client. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'Unable to reach the server. Check your connection and try again.';
    }

    const body = error.response.data?.error;
    const firstFieldError = Object.values(body?.details?.fieldErrors ?? {}).flat()[0];

    if (body?.code === 'VALIDATION_ERROR' && firstFieldError) return firstFieldError;
    if (body?.message) return body.message;
  }

  return fallback;
}
