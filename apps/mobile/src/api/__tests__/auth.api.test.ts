import * as authApi from '@/api/auth.api';
import { api } from '@/api/client';

jest.mock('@/api/client', () => ({
  api: { post: jest.fn(), get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('auth API functions', () => {
  it('posts credentials to /auth/login', async () => {
    mockedApi.post.mockResolvedValue({ data: { user: { id: 'user-123' }, accessToken: 'a', refreshToken: 'r' } });

    const result = await authApi.login({ email: 'user@example.com', password: 'Secure-password-123' });

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', { email: 'user@example.com', password: 'Secure-password-123' });
    expect(result.accessToken).toBe('a');
  });

  it('posts the registration payload to /auth/register', async () => {
    mockedApi.post.mockResolvedValue({ data: {} });

    await authApi.register({ email: 'user@example.com', password: 'Secure-password-123', firstName: 'Test' });

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', { email: 'user@example.com', password: 'Secure-password-123', firstName: 'Test' });
  });

  it('unwraps the user from /auth/me', async () => {
    mockedApi.get.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    await expect(authApi.getCurrentUser()).resolves.toEqual({ id: 'user-123' });
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
  });

  it('sends the refresh token to /auth/logout', async () => {
    mockedApi.post.mockResolvedValue({ data: {} });

    await authApi.logout('refresh-token');

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-token' });
  });

  it('posts the email to /auth/forgot-password', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'If an account exists...' } });

    await expect(authApi.forgotPassword('user@example.com')).resolves.toEqual({ message: 'If an account exists...' });
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'user@example.com' });
  });

  it('posts token and password to /auth/reset-password', async () => {
    mockedApi.post.mockResolvedValue({ data: { message: 'ok' } });

    await authApi.resetPassword({ token: 'reset-token', password: 'New-password-123' });

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'reset-token', password: 'New-password-123' });
  });

  it('posts the token to /auth/verify-email and unwraps the user', async () => {
    mockedApi.post.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    await expect(authApi.verifyEmail('verify-token')).resolves.toEqual({ id: 'user-123' });
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'verify-token' });
  });
});
