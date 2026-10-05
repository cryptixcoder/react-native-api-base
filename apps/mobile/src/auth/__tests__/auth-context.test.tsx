import { act, waitFor } from '@testing-library/react-native';

import * as authApi from '@/api/auth.api';
import { authKeys, useAuth } from '@/auth/auth-context';
import { notifySessionExpired } from '@/auth/auth-events';
import { useLogin, useLogout, useLogoutAllDevices, useRegister } from '@/auth/use-auth-mutations';
import { buildAuthResponse, buildUser, renderHookWithProviders } from '@/test/render';
import { seedTokens, storedTokens } from '@/test/secure-store';

jest.mock('@/api/auth.api');

const mockedApi = authApi as jest.Mocked<typeof authApi>;

function useAuthWithActions() {
  return {
    auth: useAuth(),
    login: useLogin(),
    register: useRegister(),
    logout: useLogout(),
    logoutAll: useLogoutAllDevices(),
  };
}

describe('AuthProvider', () => {
  it('is unauthenticated when no tokens are stored', async () => {
    const { result } = await renderHookWithProviders(useAuthWithActions);

    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(mockedApi.getCurrentUser).not.toHaveBeenCalled();
  });

  it('restores the session from stored tokens', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());

    const { result } = await renderHookWithProviders(useAuthWithActions);

    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));
    expect(result.current.auth.user?.email).toBe('user@example.com');
  });

  it('ends up signed out when the stored session cannot be restored', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockRejectedValue(new Error('401'));

    const { result } = await renderHookWithProviders(useAuthWithActions);

    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));
    expect(result.current.auth.isAuthenticated).toBe(false);
  });

  it('stores tokens and seeds the user on login', async () => {
    mockedApi.login.mockResolvedValue(buildAuthResponse());
    const { result, queryClient } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(() => result.current.login.mutateAsync({ email: 'user@example.com', password: 'Secure-password-123' }));

    expect(result.current.auth.isAuthenticated).toBe(true);
    expect(storedTokens()).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
    expect(queryClient.getQueryData(authKeys.me)).toEqual(buildUser());
    // The user came from the login response; no extra /me request.
    expect(mockedApi.getCurrentUser).not.toHaveBeenCalled();
  });

  it('stores tokens on registration', async () => {
    mockedApi.register.mockResolvedValue(buildAuthResponse());
    const { result } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(() => result.current.register.mutateAsync({ email: 'user@example.com', password: 'Secure-password-123' }));

    expect(result.current.auth.isAuthenticated).toBe(true);
    expect(storedTokens().refreshToken).toBe('new-refresh-token');
  });

  it('does not store anything when login fails', async () => {
    mockedApi.login.mockRejectedValue(new Error('Invalid email or password'));
    const { result } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.login.mutateAsync({ email: 'user@example.com', password: 'nope' })).rejects.toThrow();
    });

    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(storedTokens().refreshToken).toBeNull();
  });

  it('revokes the session server-side and clears tokens on logout', async () => {
    seedTokens({ refreshToken: 'stored-refresh' });
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());
    mockedApi.logout.mockResolvedValue();
    const { result, queryClient } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));

    await act(() => result.current.logout.mutateAsync());

    expect(mockedApi.logout).toHaveBeenCalledWith('stored-refresh');
    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(storedTokens()).toEqual({ accessToken: null, refreshToken: null });
    expect(queryClient.getQueryData(authKeys.me)).toBeUndefined();
  });

  it('still signs out locally when the logout request fails', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());
    mockedApi.logout.mockRejectedValue(new Error('Network Error'));
    const { result } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout.mutateAsync().catch(() => undefined);
    });

    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(storedTokens().refreshToken).toBeNull();
  });

  it('clears tokens on logout from all devices', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());
    mockedApi.logoutAllDevices.mockResolvedValue();
    const { result } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));

    await act(() => result.current.logoutAll.mutateAsync());

    expect(mockedApi.logoutAllDevices).toHaveBeenCalled();
    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(storedTokens().refreshToken).toBeNull();
  });

  it('signs out when the API client reports an expired session', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());
    const { result } = await renderHookWithProviders(useAuthWithActions);
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));

    await act(async () => notifySessionExpired());

    expect(result.current.auth.isAuthenticated).toBe(false);
  });
});
