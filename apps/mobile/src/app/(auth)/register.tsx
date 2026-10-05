import { Link } from 'expo-router';
import { useState } from 'react';

import { useRegister } from '@/auth/use-auth-mutations';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { EmailField, TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { getErrorMessage } from '@/lib/api-error';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterScreen() {
  const register = useRegister();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (!email.trim() || !password) {
      setValidationError('Enter your email and a password.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setValidationError(null);
    register.mutate({
      email: email.trim(),
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    });
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Create account</ThemedText>

      <FormMessage message={validationError ?? (register.isError ? getErrorMessage(register.error) : null)} />

      <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" />
      <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" />
      <EmailField value={email} onChangeText={setEmail} />
      <TextField
        label="Password"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters (12+ recommended)`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Button title="Create account" onPress={handleSubmit} loading={register.isPending} />

      <Link href="/login">
        <ThemedText type="linkPrimary">Already have an account? Sign in</ThemedText>
      </Link>
    </Screen>
  );
}
