import jwt from 'jsonwebtoken';
import { createAccessToken, createRefreshToken, verifyAccessToken } from '@/modules/auth/auth.tokens.js';
import { hashToken } from '@/utils/crypto.js';

const secret = process.env.JWT_ACCESS_SECRET as string;
const signOptions = { issuer: 'myapp-api', audience: 'myapp-mobile', subject: 'user-123' } as const;

describe('auth tokens', () => {
  describe('access tokens', () => {
    it('creates a token that can be verified', () => {
      const payload = verifyAccessToken(createAccessToken({ userId: 'user-123', role: 'USER' }));

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('USER');
      expect(payload.type).toBe('access');
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects a malformed token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('rejects an expired token', () => {
      const token = jwt.sign({ role: 'USER', type: 'access' }, secret, { ...signOptions, expiresIn: -10 });

      expect(() => verifyAccessToken(token)).toThrow(/expired/);
    });

    it('rejects a token signed with a different secret', () => {
      const token = jwt.sign({ role: 'USER', type: 'access' }, 'another-secret-that-is-long-enough-123456', signOptions);

      expect(() => verifyAccessToken(token)).toThrow();
    });

    it('rejects the wrong issuer or audience', () => {
      const wrongIssuer = jwt.sign({ role: 'USER', type: 'access' }, secret, { ...signOptions, issuer: 'someone-else' });
      const wrongAudience = jwt.sign({ role: 'USER', type: 'access' }, secret, { ...signOptions, audience: 'someone-else' });

      expect(() => verifyAccessToken(wrongIssuer)).toThrow();
      expect(() => verifyAccessToken(wrongAudience)).toThrow();
    });

    it('rejects a token of the wrong type', () => {
      const token = jwt.sign({ role: 'USER', type: 'refresh' }, secret, signOptions);

      expect(() => verifyAccessToken(token)).toThrow('Invalid access token');
    });
  });

  describe('refresh tokens', () => {
    it('returns a raw token and its hash', () => {
      const { rawToken, tokenHash } = createRefreshToken();

      expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
      expect(tokenHash).toBe(hashToken(rawToken));
    });

    it('generates unique tokens', () => {
      expect(createRefreshToken().rawToken).not.toBe(createRefreshToken().rawToken);
    });
  });
});
