// Runs before any module is imported, so src/api/client.ts sees a configured base URL.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api/v1';
