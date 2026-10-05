import { configure } from '@testing-library/react-native';

import { secureStore } from '@/test/secure-store';

// Full-router tests load every route on first render, which can exceed the 1s default
// findBy* timeout when Jest workers compete for CPU (e.g. under `turbo run test`).
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20_000);

// In-memory SecureStore so token persistence can be exercised and inspected in tests.
jest.mock('expo-secure-store', () => {
  const { secureStore: store } = jest.requireActual<typeof import('@/test/secure-store')>('@/test/secure-store');

  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

beforeEach(() => {
  secureStore.clear();
});
