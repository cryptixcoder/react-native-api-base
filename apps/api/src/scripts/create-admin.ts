/**
 * Create the first admin, or promote an existing user.
 *
 *   pnpm --filter api admin:create --email you@company.com [--password '…'] [--first-name Jane]
 *
 * Without --password for a new account, a strong random password is generated and printed once.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { logger } from '@/lib/logger.js';
import { prisma } from '@/lib/prisma.js';
import { hashPassword } from '@/utils/crypto.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    'first-name': { type: 'string' },
  },
});

const email = z.string().trim().toLowerCase().pipe(z.email()).safeParse(values.email);

if (!email.success) {
  console.error('Usage: pnpm --filter api admin:create --email you@company.com [--password …] [--first-name …]');
  process.exit(1);
}

if (values.password !== undefined && values.password.length < 12) {
  console.error('Admin passwords must be at least 12 characters.');
  process.exit(1);
}

try {
  const existing = await prisma.user.findUnique({ where: { email: email.data } });

  if (existing) {
    if (existing.status !== 'ACTIVE') {
      throw new Error(`${email.data} is ${existing.status.toLowerCase()}; reactivate it before promoting.`);
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'ADMIN',
        ...(values.password && { passwordHash: await hashPassword(values.password) }),
      },
    });
    console.log(`✔ ${email.data} is now an admin.`);
  } else {
    const password = values.password ?? randomBytes(18).toString('base64url');

    await prisma.user.create({
      data: {
        email: email.data,
        passwordHash: await hashPassword(password),
        firstName: values['first-name'] ?? null,
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✔ Created admin ${email.data}`);
    if (!values.password) console.log(`  Password (shown once, change it after signing in): ${password}`);
  }
} catch (error) {
  logger.error({ err: error }, 'admin:create failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
