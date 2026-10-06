import { z } from 'zod';

const RANGE_DAYS = [7, 30, 90] as const;

export const rangeQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => (RANGE_DAYS as readonly number[]).includes(value), { message: `days must be one of ${RANGE_DAYS.join(', ')}` })
    .default(30),
});

export const retentionQuerySchema = z.object({
  weeks: z.coerce.number().int().min(2).max(26).default(8),
});

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const listUsersQuerySchema = z.object({
  ...paginationShape,
  search: z.string().trim().max(320).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  sort: z.enum(['createdAt', 'lastLoginAt', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const auditLogQuerySchema = z.object({
  ...paginationShape,
  targetUserId: z.string().min(1).optional(),
  action: z.string().max(64).optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().min(1).max(64),
});

export const suspendUserSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason of at least 3 characters').max(500),
});

export const setRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
