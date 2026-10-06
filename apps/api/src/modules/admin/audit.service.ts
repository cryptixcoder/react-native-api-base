import type { Prisma } from '@repo/database';
import { prisma } from '@/lib/prisma.js';
import type { AuditLogQuery } from '@/modules/admin/admin.schema.js';

export type AuditAction =
  | 'user.suspended'
  | 'user.unsuspended'
  | 'user.sessions_revoked'
  | 'user.email_verified'
  | 'user.verification_resent'
  | 'user.role_changed'
  | 'user.deleted';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Record an admin action. Pass the transaction client so the entry commits atomically with the change.
 * Never put personal data (emails, names) in metadata: it would survive account anonymization.
 */
export async function recordAudit(
  db: Db,
  entry: { actorId: string; action: AuditAction; targetUserId?: string; metadata?: Prisma.InputJsonValue },
): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetUserId: entry.targetUserId ?? null,
      ...(entry.metadata !== undefined && { metadata: entry.metadata }),
    },
  });
}

const auditInclude = {
  actor: { select: { id: true, email: true } },
  target: { select: { id: true, email: true, status: true } },
} as const;

export async function listAuditLog(query: AuditLogQuery) {
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(query.targetUserId && { targetUserId: query.targetUserId }),
    ...(query.action && { action: query.action }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.adminAuditLog.findMany({
      where,
      include: auditInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { data, page: query.page, pageSize: query.pageSize, total };
}

export async function recentAuditForUser(targetUserId: string, take = 20) {
  return prisma.adminAuditLog.findMany({
    where: { targetUserId },
    include: auditInclude,
    orderBy: { createdAt: 'desc' },
    take,
  });
}
