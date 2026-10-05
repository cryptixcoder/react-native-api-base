import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { createQueryClient, subscribeAppStateFocus } from '@/api/query-client';
import { AuthProvider, useAuth } from '@/auth/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(createQueryClient);

  useEffect(subscribeAppStateFocus, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // Keep the splash screen up while the stored session is restored.
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Guards: switching isAuthenticated moves the user between these groups automatically. */}
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Email deep links (myapp://reset-password?token=…) must open whether or not the user is signed in. */}
      <Stack.Screen name="reset-password" options={{ headerShown: true, title: 'Reset password' }} />
      <Stack.Screen name="verify-email" options={{ headerShown: true, title: 'Verify email' }} />
    </Stack>
  );
}
