import { prisma } from '@/lib/prisma.js';

/**
 * Product analytics for the admin dashboard. All days are UTC calendar days and every range ends today
 * (inclusive). "Active" means the user has a row in user_activity_days for that day, which the API
 * records on sign-in, token refresh and app open (GET /auth/me).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const toDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, days: number) => toDay(new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS));

export interface Period {
  start: string;
  end: string;
}

/** The current N-day window ending today and the N days before it. */
export function periods(days: number, now = new Date()): { current: Period; previous: Period } {
  const end = toDay(now);
  const start = addDays(end, -(days - 1));
  return {
    current: { start, end },
    previous: { start: addDays(start, -days), end: addDays(start, -1) },
  };
}

export interface Comparison {
  current: number;
  previous: number;
}

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

async function countSignups(period: Period): Promise<number> {
  const [row] = await prisma.$queryRaw<[{ n: number }]>`
    SELECT count(*)::int AS n FROM users
    WHERE created_at >= ${period.start}::date AND created_at < ${period.end}::date + 1`;
  return row.n;
}

async function countActive(period: Period): Promise<number> {
  const [row] = await prisma.$queryRaw<[{ n: number }]>`
    SELECT count(DISTINCT user_id)::int AS n FROM user_activity_days
    WHERE day BETWEEN ${period.start}::date AND ${period.end}::date`;
  return row.n;
}

/** Average number of distinct active users per day over the period (days without activity count as 0). */
async function averageDailyActive(period: Period, days: number): Promise<number> {
  const [row] = await prisma.$queryRaw<[{ n: number }]>`
    SELECT count(*)::int AS n FROM user_activity_days
    WHERE day BETWEEN ${period.start}::date AND ${period.end}::date`;
  return row.n / days;
}

async function verificationRate(period: Period): Promise<number> {
  const [row] = await prisma.$queryRaw<[{ total: number; verified: number }]>`
    SELECT count(*)::int AS total, count(email_verified_at)::int AS verified FROM users
    WHERE created_at >= ${period.start}::date AND created_at < ${period.end}::date + 1 AND status <> 'DELETED'`;
  return ratio(row.verified, row.total);
}

export async function getOverview(days: number, now = new Date()) {
  const { current, previous } = periods(days, now);
  const week = periods(7, now);
  const month = periods(30, now);

  const [statusCounts, activeSessions, signups, dau, wau, mau, verification] = await Promise.all([
    prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    Promise.all([countSignups(current), countSignups(previous)]),
    Promise.all([averageDailyActive(current, days), averageDailyActive(previous, days)]),
    Promise.all([countActive(week.current), countActive(week.previous)]),
    Promise.all([countActive(month.current), countActive(month.previous)]),
    Promise.all([verificationRate(current), verificationRate(previous)]),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all]));
  const [dauMonth, dauPreviousMonth] = await Promise.all([averageDailyActive(month.current, 30), averageDailyActive(month.previous, 30)]);
  const compare = ([currentValue, previousValue]: number[]): Comparison => ({ current: currentValue ?? 0, previous: previousValue ?? 0 });

  return {
    range: { days, ...current },
    users: {
      total: (byStatus.ACTIVE ?? 0) + (byStatus.SUSPENDED ?? 0),
      active: byStatus.ACTIVE ?? 0,
      suspended: byStatus.SUSPENDED ?? 0,
      deleted: byStatus.DELETED ?? 0,
    },
    activeSessions,
    newUsers: compare(signups),
    /** Average daily active users over the selected range. */
    dau: compare(dau),
    /** Distinct users active in the last 7 days (vs the 7 before). */
    wau: compare(wau),
    /** Distinct users active in the last 30 days (vs the 30 before). */
    mau: compare(mau),
    /** Average DAU over 30 days ÷ MAU: how many days a month the typical user comes back. */
    stickiness: compare([ratio(dauMonth, mau[0]), ratio(dauPreviousMonth, mau[1])]),
    /** Share of users who signed up in the range and have verified their email. */
    verificationRate: compare(verification),
  };
}

export async function getTimeseries(days: number, now = new Date()) {
  const { current } = periods(days, now);

  return prisma.$queryRaw<{ date: string; signups: number; activeUsers: number }[]>`
    WITH days AS (
      SELECT generate_series(${current.start}::date, ${current.end}::date, interval '1 day')::date AS day
    ),
    signups AS (
      SELECT created_at::date AS day, count(*)::int AS n FROM users
      WHERE created_at >= ${current.start}::date AND created_at < ${current.end}::date + 1
      GROUP BY 1
    ),
    active AS (
      SELECT day, count(*)::int AS n FROM user_activity_days
      WHERE day BETWEEN ${current.start}::date AND ${current.end}::date
      GROUP BY 1
    )
    SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
           COALESCE(signups.n, 0) AS signups,
           COALESCE(active.n, 0) AS "activeUsers"
    FROM days
    LEFT JOIN signups USING (day)
    LEFT JOIN active USING (day)
    ORDER BY days.day`;
}

export interface RetentionCohort {
  /** Monday of the signup week (YYYY-MM-DD). */
  cohort: string;
  size: number;
  /** Share of the cohort active in week 0, 1, 2… after signup; null for weeks that haven't happened yet. */
  retention: (number | null)[];
}

/**
 * Weekly retention: users grouped by signup week, then the share of each group active in each later week.
 */
export async function getRetention(weeks: number, now = new Date()): Promise<RetentionCohort[]> {
  const rows = await prisma.$queryRaw<{ cohort: string; size: number; week: number | null; users: number | null }[]>`
    WITH cohorts AS (
      SELECT id, date_trunc('week', created_at)::date AS cohort FROM users
      WHERE created_at >= date_trunc('week', ${toDay(now)}::date) - (${weeks}::int - 1) * interval '1 week'
    ),
    sizes AS (
      SELECT cohort, count(*)::int AS size FROM cohorts GROUP BY cohort
    ),
    activity AS (
      SELECT c.cohort, ((a.day - c.cohort) / 7)::int AS week, count(DISTINCT a.user_id)::int AS users
      FROM cohorts c
      JOIN user_activity_days a ON a.user_id = c.id AND a.day >= c.cohort
      GROUP BY 1, 2
    )
    SELECT to_char(sizes.cohort, 'YYYY-MM-DD') AS cohort, sizes.size, activity.week, activity.users
    FROM sizes
    LEFT JOIN activity USING (cohort)
    ORDER BY sizes.cohort, activity.week`;

  const today = toDay(now);
  const cohorts = new Map<string, RetentionCohort>();

  for (const row of rows) {
    let cohort = cohorts.get(row.cohort);

    if (!cohort) {
      // Weeks elapsed since the cohort started, including the current partial week.
      const elapsed = Math.floor((Date.parse(today) - Date.parse(row.cohort)) / (7 * DAY_MS)) + 1;
      cohort = {
        cohort: row.cohort,
        size: row.size,
        retention: Array.from({ length: weeks }, (_, week) => (week < elapsed ? 0 : null)),
      };
      cohorts.set(row.cohort, cohort);
    }

    if (row.week !== null && row.users !== null && row.week < weeks && cohort.retention[row.week] !== null) {
      cohort.retention[row.week] = ratio(row.users, row.size);
    }
  }

  return [...cohorts.values()];
}

/**
 * Activation funnel for users who signed up in the range: registered → verified email → came back on a
 * later day → still active 7+ days after signing up. Each step only counts users who also completed every
 * previous step. Recent signups haven't had 7 days yet, so the last step is naturally lower for short ranges.
 */
export async function getFunnel(days: number, now = new Date()) {
  const { current } = periods(days, now);

  const [row] = await prisma.$queryRaw<[{ registered: number; verified: number; returned: number; retained: number }]>`
    WITH cohort AS (
      SELECT
        u.id,
        u.email_verified_at IS NOT NULL AS verified,
        EXISTS (SELECT 1 FROM user_activity_days a WHERE a.user_id = u.id AND a.day > u.created_at::date) AS returned,
        EXISTS (SELECT 1 FROM user_activity_days a WHERE a.user_id = u.id AND a.day >= u.created_at::date + 7) AS retained
      FROM users u
      WHERE u.created_at >= ${current.start}::date AND u.created_at < ${current.end}::date + 1
    )
    SELECT
      count(*)::int AS registered,
      count(*) FILTER (WHERE verified)::int AS verified,
      count(*) FILTER (WHERE verified AND returned)::int AS returned,
      count(*) FILTER (WHERE verified AND returned AND retained)::int AS retained
    FROM cohort`;

  return [
    { step: 'Registered', users: row.registered },
    { step: 'Verified email', users: row.verified },
    { step: 'Returned', users: row.returned },
    { step: 'Active after 7 days', users: row.retained },
  ];
}

const MAX_VERSIONS = 8;

/** Which platforms and app versions active users are on, by distinct users in the range. */
export async function getBreakdown(days: number, now = new Date()) {
  const { current } = periods(days, now);

  const [platforms, versions] = await Promise.all([
    prisma.$queryRaw<{ platform: string; users: number }[]>`
      SELECT COALESCE(platform, 'unknown') AS platform, count(DISTINCT user_id)::int AS users
      FROM user_activity_days
      WHERE day BETWEEN ${current.start}::date AND ${current.end}::date
      GROUP BY 1 ORDER BY users DESC`,
    prisma.$queryRaw<{ version: string; users: number }[]>`
      SELECT COALESCE(app_version, 'unknown') AS version, count(DISTINCT user_id)::int AS users
      FROM user_activity_days
      WHERE day BETWEEN ${current.start}::date AND ${current.end}::date
      GROUP BY 1 ORDER BY users DESC`,
  ]);

  const topVersions = versions.slice(0, MAX_VERSIONS);
  const otherUsers = versions.slice(MAX_VERSIONS).reduce((sum, row) => sum + row.users, 0);

  return {
    platforms,
    appVersions: otherUsers > 0 ? [...topVersions, { version: 'other', users: otherUsers }] : topVersions,
  };
}
