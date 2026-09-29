import type { User } from '@repo/database';

export type PublicUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'emailVerifiedAt' | 'createdAt'>;

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
