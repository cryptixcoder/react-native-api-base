import 'server-only';

import { apiFetch } from '@/lib/api';
import type { AuditEntry, Paginated } from '@/types/api';

export const AUDIT_PAGE_SIZE = 50;

export const listAuditLog = (query: { page: number; targetUserId?: string }) =>
  apiFetch<Paginated<AuditEntry>>('/admin/audit-log', { query: { ...query, pageSize: AUDIT_PAGE_SIZE } });
