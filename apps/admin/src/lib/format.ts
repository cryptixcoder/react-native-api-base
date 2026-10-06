const numberFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatNumber = (value: number) => (Math.abs(value) >= 10_000 ? compactFormat.format(value) : numberFormat.format(Math.round(value * 10) / 10));

export const formatPercent = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits).replace(/\.0+$/, '')}%`;

/** Relative change between two periods, or null when there's no baseline to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export function formatChange(change: number | null): string {
  if (change === null) return 'new';
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return `${sign}${formatPercent(Math.abs(change))}`;
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const localDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Calendar days from the analytics API (YYYY-MM-DD) are UTC days and shown as-is; timestamps are shown
 * in the viewer's local time, like formatDateTime.
 */
export const formatDate = (value: string | Date) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : localDateFormat.format(new Date(value));

export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value));

const relativeFormat = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

export function formatRelative(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return 'Never';
  const diff = new Date(value).getTime() - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relativeFormat.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function displayName(user: { firstName: string | null; lastName: string | null; email: string; status?: string }): string {
  if (user.status === 'DELETED') return 'Deleted account';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

/** Best-effort device label from a user agent. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  if (/iPhone|iPad|CFNetwork|Darwin/i.test(userAgent)) return 'iOS';
  if (/Android|okhttp/i.test(userAgent)) return 'Android';
  if (/Mozilla/i.test(userAgent)) return 'Web browser';
  return userAgent.slice(0, 40);
}
