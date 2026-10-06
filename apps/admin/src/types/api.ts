// Response shapes of the Express admin API (apps/api/src/modules/admin). Dates arrive as ISO strings.

export type Role = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UserSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; email: string } | null;
  target: { id: string; email: string; status: UserStatus } | null;
}

export interface UserDetail {
  user: AdminUser;
  sessions: UserSession[];
  activity: { day: string; platform: string | null; appVersion: string | null }[];
  lastActive: { day: string; platform: string | null; appVersion: string | null; lastSeenAt: string } | null;
  audit: AuditEntry[];
}

export interface Comparison {
  current: number;
  previous: number;
}

export interface Overview {
  range: { days: number; start: string; end: string };
  users: { total: number; active: number; suspended: number; deleted: number };
  activeSessions: number;
  newUsers: Comparison;
  dau: Comparison;
  wau: Comparison;
  mau: Comparison;
  stickiness: Comparison;
  verificationRate: Comparison;
}

export interface TimeseriesPoint {
  date: string;
  signups: number;
  activeUsers: number;
}

export interface RetentionCohort {
  cohort: string;
  size: number;
  retention: (number | null)[];
}

export interface FunnelStep {
  step: string;
  users: number;
}

export interface Breakdown {
  platforms: { platform: string; users: number }[];
  appVersions: { version: string; users: number }[];
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
}
