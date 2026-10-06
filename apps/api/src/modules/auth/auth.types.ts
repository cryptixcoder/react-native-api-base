import type { ClientInfo } from '@/modules/activity/activity.service.js';
import type { User } from '@repo/database';

export type PublicUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'status' | 'emailVerifiedAt' | 'createdAt'>;

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface RequestMetadata {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export interface RequestContext extends RequestMetadata {
  client: ClientInfo;
}
