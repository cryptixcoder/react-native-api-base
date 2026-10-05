import { Router } from 'express';
import { prisma } from '@/lib/prisma.js';
import { asyncHandler } from '@/middleware/async-handler.js';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  }),
);
