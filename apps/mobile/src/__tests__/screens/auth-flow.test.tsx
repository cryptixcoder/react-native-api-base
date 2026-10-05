import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import * as authApi from '@/api/auth.api';
import { buildAuthResponse, buildUser } from '@/test/render';
import { seedTokens } from '@/test/secure-store';

jest.mock('@/api/auth.api');
// The app's QueryClient keeps 5-minute GC timers alive after a test; use the test client instead.
jest.mock('@/api/query-client', () => ({
  ...jest.requireActual('@/api/query-client'),
  createQueryClient: () => jest.requireActual<typeof import('@/test/render')>('@/test/render').createTestQueryClient(),
}));

const mockedApi = authApi as jest.Mocked<typeof authApi>;

/** Renders the real app (src/app) at a URL, with providers, guards and navigation. */
async function renderApp(initialUrl = '/') {
  // With RNTL v14, render() is async: renderRouter returns a promise that also carries the router helpers.
  const result = renderRouter('./src/app', { initialUrl });
  await result;
  // Not returned directly: an async function would unwrap the thenable and drop the helpers.
  return { getPathname: () => result.getPathname() };
}

describe('auth flow (full router)', () => {
  it('sends signed-out users to the login screen', async () => {
    const app = await renderApp('/');

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/login');
  });

  it('restores a stored session straight into the app', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());

    const app = await renderApp('/');

    expect(await screen.findByText('Hello, Test')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
  });

  it('keeps signed-in users out of the auth screens', async () => {
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser());

    const app = await renderApp('/login');

    expect(await screen.findByText('Hello, Test')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/');
  });

  it('logs in and lands on the home screen', async () => {
    const user = userEvent.setup();
    mockedApi.login.mockResolvedValue(buildAuthResponse());
    const app = await renderApp('/login');

    await user.type(await screen.findByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secure-password-123');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Hello, Test')).toBeOnTheScreen();
    expect(mockedApi.login).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Secure-password-123' });
    expect(app.getPathname()).toBe('/');
  });

  it('logs out back to the login screen', async () => {
    const user = userEvent.setup();
    seedTokens();
    mockedApi.getCurrentUser.mockResolvedValue(buildUser({ emailVerifiedAt: '2026-01-02T00:00:00.000Z' }));
    mockedApi.logout.mockResolvedValue();
    const app = await renderApp('/');

    await user.press(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/login');
  });

  it('opens the reset-password deep link and submits the token', async () => {
    const user = userEvent.setup();
    mockedApi.resetPassword.mockResolvedValue({ message: 'ok' });
    await renderApp('/reset-password?token=reset-token-123');

    await user.type(await screen.findByLabelText('New password'), 'New-password-123');
    await user.type(screen.getByLabelText('Confirm new password'), 'New-password-123');
    await user.press(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password updated')).toBeOnTheScreen();
    expect(mockedApi.resetPassword).toHaveBeenCalledWith({ token: 'reset-token-123', password: 'New-password-123' });
  });

  it('verifies the email from the deep link', async () => {
    mockedApi.verifyEmail.mockResolvedValue(buildUser({ emailVerifiedAt: '2026-01-02T00:00:00.000Z' }));
    await renderApp('/verify-email?token=verify-token-123');

    expect(await screen.findByText('Email verified')).toBeOnTheScreen();
    await waitFor(() => expect(mockedApi.verifyEmail).toHaveBeenCalledWith('verify-token-123'));
  });
});
