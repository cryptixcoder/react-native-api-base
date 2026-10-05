import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/auth/auth-context';
import { useResetPassword } from '@/auth/use-auth-mutations';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/api-error';

const MIN_PASSWORD_LENGTH = 8;

/** Opened from the password reset email: myapp://reset-password?token=… */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { endSession } = useAuth();
  const resetPassword = useResetPassword();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (!token) {
      setValidationError('This password reset link is missing its token. Request a new one.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setValidationError(null);
    resetPassword.mutate(
      { token, password },
      // A reset revokes every session server-side, so drop any local one too.
      { onSuccess: () => endSession() },
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <Screen>
        <ThemedText type="subtitle">Password updated</ThemedText>
        <ThemedText>Your password has been reset. Sign in with your new password.</ThemedText>
        <Button title="Sign in" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Create new password</ThemedText>

      <FormMessage message={validationError ?? (resetPassword.isError ? getErrorMessage(resetPassword.error) : null)} />

      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <TextField
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
      />

      <Button title="Update password" onPress={handleSubmit} loading={resetPassword.isPending} />
    </Screen>
  );
}
