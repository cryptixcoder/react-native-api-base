import { Router } from 'express';
import { asyncHandler } from '@/middleware/async-handler.js';
import { requireAuth, requireRole } from '@/middleware/auth.middleware.js';
import { validate } from '@/middleware/validate.js';
import * as admin from '@/modules/admin/admin.controller.js';
import { setRoleSchema, suspendUserSchema, userIdParamsSchema } from '@/modules/admin/admin.schema.js';

/**
 * Admin API, consumed by apps/admin. Every route requires an active account with the ADMIN role.
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

const withUserId = validate({ params: userIdParamsSchema });

adminRouter.get('/analytics/overview', asyncHandler(admin.overview));
adminRouter.get('/analytics/timeseries', asyncHandler(admin.timeseries));
adminRouter.get('/analytics/retention', asyncHandler(admin.retention));
adminRouter.get('/analytics/funnel', asyncHandler(admin.funnel));
adminRouter.get('/analytics/breakdown', asyncHandler(admin.breakdown));

adminRouter.get('/users', asyncHandler(admin.listUsers));
adminRouter.get('/users/:id', withUserId, asyncHandler(admin.getUser));
adminRouter.post('/users/:id/suspend', withUserId, validate({ body: suspendUserSchema }), asyncHandler(admin.suspendUser));
adminRouter.post('/users/:id/unsuspend', withUserId, asyncHandler(admin.unsuspendUser));
adminRouter.post('/users/:id/revoke-sessions', withUserId, asyncHandler(admin.revokeSessions));
adminRouter.post('/users/:id/verify-email', withUserId, asyncHandler(admin.verifyEmail));
adminRouter.post('/users/:id/resend-verification', withUserId, asyncHandler(admin.resendVerification));
adminRouter.patch('/users/:id/role', withUserId, validate({ body: setRoleSchema }), asyncHandler(admin.setRole));
adminRouter.delete('/users/:id', withUserId, asyncHandler(admin.deleteUser));

adminRouter.get('/audit-log', asyncHandler(admin.auditLog));
