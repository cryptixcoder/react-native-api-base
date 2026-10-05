import { Link } from 'expo-router';
import { useState } from 'react';

import { useForgotPassword } from '@/auth/use-auth-mutations';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { EmailField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/api-error';

export default function ForgotPasswordScreen() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (!email.trim()) {
      setValidationError('Enter the email associated with your account.');
      return;
    }

    setValidationError(null);
    forgotPassword.mutate(email.trim());
  }

  if (forgotPassword.isSuccess) {
    return (
      <Screen>
        <ThemedText type="subtitle">Check your email</ThemedText>
        {/* The API answers identically whether or not the account exists. */}
        <ThemedText>If an account exists for that email, we&apos;ve sent instructions to reset your password.</ThemedText>
        <Link href="/login">
          <ThemedText type="linkPrimary">Return to sign in</ThemedText>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Forgot password?</ThemedText>
      <ThemedText themeColor="textSecondary">Enter your email and we&apos;ll send you a password reset link.</ThemedText>

      <FormMessage message={validationError ?? (forgotPassword.isError ? getErrorMessage(forgotPassword.error) : null)} />

      <EmailField value={email} onChangeText={setEmail} onSubmitEditing={handleSubmit} />
      <Button title="Send reset link" onPress={handleSubmit} loading={forgotPassword.isPending} />

      <Link href="/login">
        <ThemedText type="linkPrimary">Return to sign in</ThemedText>
      </Link>
    </Screen>
  );
}
