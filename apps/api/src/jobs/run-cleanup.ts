// One-off manual cleanup: `pnpm --filter api jobs:cleanup`. The worker runs the same job on CLEANUP_CRON.
import { logger } from '@/lib/logger.js';
import { prisma } from '@/lib/prisma.js';
import { cleanupExpiredAuthData } from '@/jobs/cleanup.js';

try {
  const result = await cleanupExpiredAuthData();
  logger.info(result, 'auth cleanup complete');
} catch (error) {
  logger.error({ err: error }, 'auth cleanup failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
