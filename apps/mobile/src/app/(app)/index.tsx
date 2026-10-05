import { useAuth } from '@/auth/auth-context';
import { useLogout, useLogoutAllDevices, useResendVerification } from '@/auth/use-auth-mutations';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/api-error';

export default function HomeScreen() {
  const { user } = useAuth();
  const logout = useLogout();
  const logoutAll = useLogoutAllDevices();
  const resendVerification = useResendVerification();

  if (!user) return null;

  const name = user.firstName ?? user.email;

  return (
    <Screen>
      <ThemedText type="subtitle">Hello, {name}</ThemedText>
      <ThemedText themeColor="textSecondary">Signed in as {user.email}</ThemedText>

      {!user.emailVerifiedAt ? (
        <>
          <FormMessage tone="info" message="Your email isn't verified yet. Check your inbox for the verification link." />
          <FormMessage
            tone={resendVerification.isError ? 'error' : 'info'}
            message={
              resendVerification.isSuccess
                ? 'Verification email sent.'
                : resendVerification.isError
                  ? getErrorMessage(resendVerification.error)
                  : null
            }
          />
          <Button
            title="Resend verification email"
            variant="secondary"
            onPress={() => resendVerification.mutate(user.email)}
            loading={resendVerification.isPending}
            disabled={resendVerification.isSuccess}
          />
        </>
      ) : null}

      <Button title="Sign out" variant="secondary" onPress={() => logout.mutate()} loading={logout.isPending} />
      <Button title="Sign out of all devices" variant="destructive" onPress={() => logoutAll.mutate()} loading={logoutAll.isPending} />
    </Screen>
  );
}
