import type { Request, Response } from 'express';
import { getAuthUser } from '@/middleware/auth.middleware.js';
import type { AuditLogQuery, ListUsersQuery } from '@/modules/admin/admin.schema.js';
import { auditLogQuerySchema, listUsersQuerySchema, rangeQuerySchema, retentionQuerySchema } from '@/modules/admin/admin.schema.js';
import * as usersService from '@/modules/admin/admin-users.service.js';
import * as analytics from '@/modules/admin/analytics.service.js';
import { listAuditLog } from '@/modules/admin/audit.service.js';

// Express 5 exposes req.query as a read-only getter, so queries are parsed here (validate() only checks them).
// Bodies and params have already been parsed by validate() in admin.routes.ts.

const userId = (req: Request) => req.params.id as string;

// Analytics -------------------------------------------------------------------------------------

export async function overview(req: Request, res: Response): Promise<void> {
  const { days } = rangeQuerySchema.parse(req.query);
  res.json({ data: await analytics.getOverview(days) });
}

export async function timeseries(req: Request, res: Response): Promise<void> {
  const { days } = rangeQuerySchema.parse(req.query);
  res.json({ data: await analytics.getTimeseries(days) });
}

export async function retention(req: Request, res: Response): Promise<void> {
  const { weeks } = retentionQuerySchema.parse(req.query);
  res.json({ data: await analytics.getRetention(weeks) });
}

export async function funnel(req: Request, res: Response): Promise<void> {
  const { days } = rangeQuerySchema.parse(req.query);
  res.json({ data: await analytics.getFunnel(days) });
}

export async function breakdown(req: Request, res: Response): Promise<void> {
  const { days } = rangeQuerySchema.parse(req.query);
  res.json({ data: await analytics.getBreakdown(days) });
}

// Users -----------------------------------------------------------------------------------------

export async function listUsers(req: Request, res: Response): Promise<void> {
  res.json(await usersService.listUsers(listUsersQuerySchema.parse(req.query) as ListUsersQuery));
}

export async function getUser(req: Request, res: Response): Promise<void> {
  res.json({ data: await usersService.getUserDetail(userId(req)) });
}

export async function suspendUser(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason: string };
  res.json({ data: await usersService.suspendUser(getAuthUser(req).id, userId(req), reason) });
}

export async function unsuspendUser(req: Request, res: Response): Promise<void> {
  res.json({ data: await usersService.unsuspendUser(getAuthUser(req).id, userId(req)) });
}

export async function revokeSessions(req: Request, res: Response): Promise<void> {
  res.json({ data: await usersService.revokeUserSessions(getAuthUser(req).id, userId(req)) });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  res.json({ data: await usersService.verifyUserEmail(getAuthUser(req).id, userId(req)) });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await usersService.resendUserVerification(getAuthUser(req).id, userId(req));
  res.json({ data: { sent: true } });
}

export async function setRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: 'USER' | 'ADMIN' };
  res.json({ data: await usersService.setUserRole(getAuthUser(req).id, userId(req), role) });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  res.json({ data: await usersService.deleteUser(getAuthUser(req).id, userId(req)) });
}

// Audit log -------------------------------------------------------------------------------------

export async function auditLog(req: Request, res: Response): Promise<void> {
  res.json(await listAuditLog(auditLogQuerySchema.parse(req.query) as AuditLogQuery));
}
