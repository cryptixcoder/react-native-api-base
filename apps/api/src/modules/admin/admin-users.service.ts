import type { Prisma, Role, User } from '@repo/database';
import { prisma } from '@/lib/prisma.js';
import { AppError } from '@/middleware/error-handler.js';
import * as authService from '@/modules/auth/auth.service.js';
import type { ListUsersQuery } from '@/modules/admin/admin.schema.js';
import { recentAuditForUser, recordAudit } from '@/modules/admin/audit.service.js';
import { toDay } from '@/modules/admin/analytics.service.js';

/** Fields the admin panel may see. Never includes the password hash. */
const adminUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  suspendedAt: true,
  suspendedReason: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type AdminUser = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

const notFound = () => new AppError(404, 'USER_NOT_FOUND', 'User not found');

export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.role && { role: query.role }),
    ...(query.search && {
      OR: [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { id: query.search },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      // Users who never logged in sort last; id is a stable tiebreaker for consistent pagination.
      orderBy: [query.sort === 'lastLoginAt' ? { lastLoginAt: { sort: query.order, nulls: 'last' } } : { [query.sort]: query.order }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, page: query.page, pageSize: query.pageSize, total };
}

export async function getUserDetail(id: string, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id }, select: adminUserSelect });
  if (!user) throw notFound();

  const since = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

  const [sessions, activity, lastActive, audit] = await Promise.all([
    prisma.authSession.findMany({
      where: { userId: id, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userActivityDay.findMany({
      where: { userId: id, day: { gte: new Date(toDay(since)) } },
      select: { day: true, platform: true, appVersion: true },
      orderBy: { day: 'asc' },
    }),
    prisma.userActivityDay.findFirst({
      where: { userId: id },
      select: { day: true, platform: true, appVersion: true, lastSeenAt: true },
      orderBy: { day: 'desc' },
    }),
    recentAuditForUser(id),
  ]);

  return {
    user,
    sessions,
    activity: activity.map((row) => ({ ...row, day: toDay(row.day) })),
    lastActive: lastActive && { ...lastActive, day: toDay(lastActive.day) },
    audit,
  };
}

// ---------------------------------------------------------------------------------------------
// Actions. Each runs in a transaction with its audit entry.
// ---------------------------------------------------------------------------------------------

async function loadTarget(tx: Prisma.TransactionClient, id: string): Promise<User> {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw notFound();
  return user;
}

function assertNotSelf(actorId: string, target: User): void {
  if (actorId === target.id) {
    throw new AppError(409, 'CANNOT_MODIFY_SELF', 'You cannot perform this action on your own account');
  }
}

function assertNotDeleted(target: User): void {
  if (target.status === 'DELETED') {
    throw new AppError(409, 'USER_DELETED', 'This account has been deleted');
  }
}

/** Keep at least one active admin so the panel can never be locked out. */
async function assertNotLastAdmin(tx: Prisma.TransactionClient, target: User): Promise<void> {
  if (target.role !== 'ADMIN' || target.status !== 'ACTIVE') return;

  const otherAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', id: { not: target.id } } });
  if (otherAdmins === 0) {
    throw new AppError(409, 'LAST_ADMIN', 'At least one active admin is required');
  }
}

async function revokeAllSessions(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const { count } = await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return count;
}

const selectAdminUser = (tx: Prisma.TransactionClient, id: string) => tx.user.findUniqueOrThrow({ where: { id }, select: adminUserSelect });

/** Lock the account out: blocks sign-in immediately and signs out every device. */
export async function suspendUser(actorId: string, id: string, reason: string): Promise<AdminUser> {
  return prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, id);
    assertNotSelf(actorId, target);
    assertNotDeleted(target);
    if (target.status === 'SUSPENDED') throw new AppError(409, 'ALREADY_SUSPENDED', 'This account is already suspended');
    await assertNotLastAdmin(tx, target);

    await tx.user.update({ where: { id }, data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: reason } });
    const sessionsRevoked = await revokeAllSessions(tx, id);
    await recordAudit(tx, { actorId, action: 'user.suspended', targetUserId: id, metadata: { reason, sessionsRevoked } });

    return selectAdminUser(tx, id);
  });
}

export async function unsuspendUser(actorId: string, id: string): Promise<AdminUser> {
  return prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, id);
    if (target.status !== 'SUSPENDED') throw new AppError(409, 'NOT_SUSPENDED', 'This account is not suspended');

    await tx.user.update({ where: { id }, data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null } });
    await recordAudit(tx, { actorId, action: 'user.unsuspended', targetUserId: id });

    return selectAdminUser(tx, id);
  });
}

/** Sign the user out of every device without locking the account. */
export async function revokeUserSessions(actorId: string, id: string): Promise<{ revoked: number }> {
  return prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, id);
    assertNotDeleted(target);

    const revoked = await revokeAllSessions(tx, id);
    await recordAudit(tx, { actorId, action: 'user.sessions_revoked', targetUserId: id, metadata: { revoked } });

    return { revoked };
  });
}

export async function verifyUserEmail(actorId: string, id: string): Promise<AdminUser> {
  return prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, id);
    assertNotDeleted(target);
    if (target.emailVerifiedAt) throw new AppError(409, 'ALREADY_VERIFIED', 'This email is already verified');

    await tx.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
    await tx.emailVerificationToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } });
    await recordAudit(tx, { actorId, action: 'user.email_verified', targetUserId: id });

    return selectAdminUser(tx, id);
  });
}

export async function resendUserVerification(actorId: string, id: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound();
  assertNotDeleted(target);
  if (target.emailVerifiedAt) throw new AppError(409, 'ALREADY_VERIFIED', 'This email is already verified');
  if (target.status !== 'ACTIVE') throw new AppError(409, 'USER_INACTIVE', 'This account is not active');

  await authService.resendVerification(target.email);
  await recordAudit(prisma, { actorId, action: 'user.verification_resent', targetUserId: id });
}

export async function setUserRole(actorId: string, id: string, role: Role): Promise<AdminUser> {
  return prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, id);
    assertNotSelf(actorId, target);
    assertNotDeleted(target);
    if (target.role === role) return selectAdminUser(tx, id);
    if (role !== 'ADMIN') await assertNotLastAdmin(tx, target);

    await tx.user.update({ where: { id }, data: { role } });
    await recordAudit(tx, { actorId, action: 'user.role_changed', targetUserId: id, metadata: { from: target.role, to: role } });

    return selectAdminUser(tx, id);
  });
}

/**
 * Delete an account by anonymizing it: personal data is wiped and the account can never sign in again,
 * but the row is kept so analytics history and the audit trail stay intact. The original email address
 * is released and can be used to register a new account.
 */
export async function deleteUser(actorId: string, id: string): Promise<AdminUser> {
  return prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, id);
    assertNotSelf(actorId, target);
    assertNotDeleted(target);
    await assertNotLastAdmin(tx, target);

    await tx.user.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        email: `deleted+${id}@deleted.invalid`,
        firstName: null,
        lastName: null,
        passwordHash: null,
        suspendedReason: null,
        role: 'USER',
      },
    });
    const sessionsRevoked = await revokeAllSessions(tx, id);
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: id } });
    // Device details are personal data too.
    await tx.authSession.updateMany({ where: { userId: id }, data: { userAgent: null, ipAddress: null } });
    await recordAudit(tx, { actorId, action: 'user.deleted', targetUserId: id, metadata: { sessionsRevoked } });

    return selectAdminUser(tx, id);
  });
}
