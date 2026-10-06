import 'server-only';

import { apiData, apiFetch } from '@/lib/api';
import type { AdminUser, Paginated, Role, UserDetail, UserStatus } from '@/types/api';

export interface UserListQuery {
  page: number;
  search?: string;
  status?: UserStatus;
  role?: Role;
}

export const PAGE_SIZE = 25;

export function parseUserListQuery(params: Record<string, string | string[] | undefined>): UserListQuery {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = one(params.status);
  const role = one(params.role);

  return {
    page: Math.max(1, Number(one(params.page)) || 1),
    search: one(params.search)?.trim() || undefined,
    status: status === 'ACTIVE' || status === 'SUSPENDED' || status === 'DELETED' ? status : undefined,
    role: role === 'USER' || role === 'ADMIN' ? role : undefined,
  };
}

export const listUsers = (query: UserListQuery) =>
  apiFetch<Paginated<AdminUser>>('/admin/users', { query: { ...query, pageSize: PAGE_SIZE } });

export const getUser = (id: string) => apiData<UserDetail>(`/admin/users/${encodeURIComponent(id)}`);
