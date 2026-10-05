import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/auth/auth-context';
import { useVerifyEmail } from '@/auth/use-auth-mutations';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/api-error';

/** Opened from the verification email: myapp://verify-email?token=… Verifies automatically. */
export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { isAuthenticated } = useAuth();
  const { mutate, isIdle, isPending, isSuccess, isError, error } = useVerifyEmail();

  useEffect(() => {
    if (token && isIdle) mutate(token);
  }, [token, isIdle, mutate]);

  const continueButton = <Button title="Continue" onPress={() => router.replace(isAuthenticated ? '/' : '/login')} />;

  if (!token) {
    return (
      <Screen>
        <FormMessage message="This verification link is missing its token." />
        {continueButton}
      </Screen>
    );
  }

  return (
    <Screen>
      {isPending || isIdle ? <ThemedText>Verifying your email…</ThemedText> : null}
      {isSuccess ? <ThemedText type="subtitle">Email verified</ThemedText> : null}
      <FormMessage message={isError ? getErrorMessage(error) : null} />
      {isSuccess || isError ? continueButton : null}
    </Screen>
  );
}
