import { Link } from 'expo-router';
import { useState } from 'react';

import { useLogin } from '@/auth/use-auth-mutations';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { EmailField, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/api-error';

export default function LoginScreen() {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (!email.trim() || !password) {
      setValidationError('Enter your email and password.');
      return;
    }

    setValidationError(null);
    // On success the root layout's guard switches to the (app) group.
    login.mutate({ email: email.trim(), password });
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Welcome back</ThemedText>

      <FormMessage message={validationError ?? (login.isError ? getErrorMessage(login.error) : null)} />

      <EmailField value={email} onChangeText={setEmail} />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />

      <Button title="Sign in" onPress={handleSubmit} loading={login.isPending} />

      <Link href="/forgot-password">
        <ThemedText type="linkPrimary">Forgot password?</ThemedText>
      </Link>
      <Link href="/register">
        <ThemedText type="linkPrimary">Create an account</ThemedText>
      </Link>
    </Screen>
  );
}
