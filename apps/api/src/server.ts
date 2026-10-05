import { createServer } from 'node:http';
import { createApp } from '@/app.js';
import { env } from '@config/env.js';
import { logger } from '@/lib/logger.js';
import { prisma } from '@/lib/prisma.js';
import { closeRedis } from '@/lib/redis.js';
import { closeEmailQueue } from '@/modules/email/email.queue.js';

const server = createServer(createApp());

server.listen(env.PORT, () => logger.info({ port: env.PORT, url: env.API_URL }, 'API listening'));

let shuttingDown = false;

function shutdown(signal: string, exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutdown started');

  server.close(async (error) => {
    await closeEmailQueue();
    await Promise.all([prisma.$disconnect(), closeRedis()]);

    if (error) {
      logger.error({ err: error }, 'shutdown failed');
      process.exit(1);
    }

    logger.info('shutdown complete');
    process.exit(exitCode);
  });

  // Force exit if open connections keep the server alive.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  shutdown('uncaughtException', 1);
});
