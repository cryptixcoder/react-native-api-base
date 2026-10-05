import { generateSecureToken, hashPassword, hashToken, safeCompare, verifyPassword } from '@/utils/crypto.js';

describe('crypto utilities', () => {
  describe('password hashing', () => {
    it('hashes with argon2id and verifies the original password', async () => {
      const password = 'My-secure-password-123';
      const passwordHash = await hashPassword(password);

      expect(passwordHash).not.toBe(password);
      expect(passwordHash.startsWith('$argon2id$')).toBe(true);
      await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await hashPassword('My-secure-password-123');

      await expect(verifyPassword(passwordHash, 'wrong-password')).resolves.toBe(false);
    });

    it('salts hashes so the same password hashes differently', async () => {
      const [hash1, hash2] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('opaque tokens', () => {
    it('generates 256-bit hex tokens', () => {
      expect(generateSecureToken()).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique tokens', () => {
      expect(generateSecureToken()).not.toBe(generateSecureToken());
    });

    it('hashes the same token consistently', () => {
      expect(hashToken('test-token')).toBe(hashToken('test-token'));
      expect(hashToken('test-token')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different tokens', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });

  describe('safeCompare', () => {
    it('returns true for equal strings', () => {
      expect(safeCompare('abc123', 'abc123')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(safeCompare('abc123', 'abc124')).toBe(false);
    });

    it('returns false for different-length strings', () => {
      expect(safeCompare('abc', 'abcd')).toBe(false);
    });
  });
});
