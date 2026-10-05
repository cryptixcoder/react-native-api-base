/** Backing map for the expo-secure-store mock in src/test/setup.ts. */
export const secureStore = new Map<string, string>();

export function seedTokens(tokens: { accessToken?: string; refreshToken?: string } = {}): void {
  secureStore.set('auth.access_token', tokens.accessToken ?? 'stored-access-token');
  secureStore.set('auth.refresh_token', tokens.refreshToken ?? 'stored-refresh-token');
}

export function storedTokens() {
  return {
    accessToken: secureStore.get('auth.access_token') ?? null,
    refreshToken: secureStore.get('auth.refresh_token') ?? null,
  };
}
