// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
  },
  {
    files: ['src/**/__tests__/**', 'src/test/**'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
