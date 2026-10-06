/**
 * Fill the development database with realistic demo data so the admin dashboard has something to show:
 * an admin account plus ~400 users with 120 days of signups, activity, platforms and app versions.
 *
 *   pnpm db:seed                 (admin@example.com / Admin-password-123)
 *   pnpm db:seed --users 1000
 *
 * Re-running replaces the previous demo users. Every demo user's password is "Demo-password-123".
 * Refuses to run in production.
 */
import { parseArgs } from 'node:util';
import type { Prisma } from '@repo/database';
import { env } from '@config/env.js';
import { prisma } from '@/lib/prisma.js';
import { hashPassword } from '@/utils/crypto.js';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

const { values } = parseArgs({ options: { users: { type: 'string', default: '400' } } });
const USER_COUNT = Math.max(10, Number.parseInt(values.users, 10) || 400);
const HISTORY_DAYS = 120;
const DAY = 24 * 60 * 60 * 1000;
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin-password-123';
const DEMO_DOMAIN = '@demo.example.com';

// Deterministic randomness, so every developer sees the same charts.
let seed = 20260101;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

const FIRST_NAMES = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Isla', 'Lucas', 'Aria', 'Mason', 'Nora', 'Leo', 'Maya', 'Kai', 'Ella', 'Omar'];
const LAST_NAMES = ['Smith', 'Garcia', 'Chen', 'Patel', 'Johnson', 'Kim', 'Brown', 'Nguyen', 'Silva', 'Okafor', 'Müller', 'Rossi', 'Cohen', 'Ali'];

// App versions released over the demo period (days ago); users drift onto newer releases.
const RELEASES = [
  { version: '1.0.0', daysAgo: 120 },
  { version: '1.1.0', daysAgo: 85 },
  { version: '1.2.0', daysAgo: 50 },
  { version: '1.3.0', daysAgo: 20 },
  { version: '1.3.1', daysAgo: 6 },
] as const;

function versionOn(daysAgo: number): string {
  const available = RELEASES.filter((release) => release.daysAgo >= daysAgo);
  // Most users update within a couple of weeks; some lag one version behind.
  const latest = available.at(-1)!;
  const lagging = available.at(-2);
  return lagging && latest.daysAgo - daysAgo < 10 && random() < 0.6 ? lagging.version : latest.version;
}

const startOfUtcDay = (date: Date) => new Date(date.toISOString().slice(0, 10));
const today = startOfUtcDay(new Date());

async function main(): Promise<void> {
  console.log(`Seeding ${USER_COUNT} demo users over ${HISTORY_DAYS} days…`);

  const [adminHash, demoHash] = await Promise.all([hashPassword(ADMIN_PASSWORD), hashPassword('Demo-password-123')]);

  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_DOMAIN } } });

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { email: ADMIN_EMAIL, passwordHash: adminHash, firstName: 'Admin', role: 'ADMIN', emailVerifiedAt: new Date() },
    update: { passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE' },
  });

  const users: Prisma.UserCreateManyInput[] = [];
  const activity: Prisma.UserActivityDayCreateManyInput[] = [];

  for (let i = 0; i < USER_COUNT; i++) {
    // Growth curve: more signups in recent weeks.
    const signupDaysAgo = Math.floor(HISTORY_DAYS * (1 - Math.sqrt(random())));
    const createdAt = new Date(today.getTime() - signupDaysAgo * DAY + Math.floor(random() * DAY * 0.9));
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const id = `demo${String(i).padStart(5, '0')}`;
    const roll = random();
    const status = roll < 0.02 ? 'SUSPENDED' : roll < 0.03 ? 'DELETED' : 'ACTIVE';
    const platform = random() < 0.55 ? 'ios' : random() < 0.92 ? 'android' : 'web';
    const verified = random() < 0.72;

    users.push({
      id,
      email: status === 'DELETED' ? `deleted+${id}${DEMO_DOMAIN}` : `${firstName}.${lastName}.${i}${DEMO_DOMAIN}`.toLowerCase(),
      passwordHash: status === 'DELETED' ? null : demoHash,
      firstName: status === 'DELETED' ? null : firstName,
      lastName: status === 'DELETED' ? null : lastName,
      status,
      createdAt,
      emailVerifiedAt: verified ? new Date(createdAt.getTime() + random() * DAY) : null,
      suspendedAt: status === 'SUSPENDED' ? new Date(createdAt.getTime() + DAY) : null,
      suspendedReason: status === 'SUSPENDED' ? 'Demo: reported for spam' : null,
      deletedAt: status === 'DELETED' ? new Date(createdAt.getTime() + 2 * DAY) : null,
    });

    // Engagement: a share of users churn quickly, the rest return with a habit that decays slowly.
    const churnsEarly = random() < 0.45;
    const habit = 0.15 + random() * 0.55;
    let lastActiveDaysAgo = signupDaysAgo;

    for (let daysAgo = signupDaysAgo; daysAgo >= 0; daysAgo--) {
      const age = signupDaysAgo - daysAgo;
      const weekend = [0, 6].includes(new Date(today.getTime() - daysAgo * DAY).getUTCDay()) ? 1.15 : 1;
      const probability = age === 0 ? 1 : churnsEarly ? (age < 7 ? 0.25 : 0.01) : habit * Math.exp(-age / 90) * weekend;

      if (status !== 'ACTIVE' && age > 3) break;
      if (random() > probability) continue;

      lastActiveDaysAgo = daysAgo;
      activity.push({
        userId: id,
        day: new Date(today.getTime() - daysAgo * DAY),
        platform,
        appVersion: platform === 'web' ? null : versionOn(daysAgo),
      });
    }

    const lastLogin = users.at(-1)!;
    lastLogin.lastLoginAt = new Date(today.getTime() - lastActiveDaysAgo * DAY + 9 * 60 * 60 * 1000);
  }

  await prisma.user.createMany({ data: users });
  for (let i = 0; i < activity.length; i += 5000) {
    await prisma.userActivityDay.createMany({ data: activity.slice(i, i + 5000) });
  }

  console.log(`✔ Seeded ${users.length} users and ${activity.length} activity days.`);
  console.log(`  Admin panel login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Demo users sign in with: <email> / Demo-password-123`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
