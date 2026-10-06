import 'server-only';

import { apiData } from '@/lib/api';
import type { Breakdown, FunnelStep, Overview, RetentionCohort, TimeseriesPoint } from '@/types/api';

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(value: string | string[] | undefined): RangeDays {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (RANGES as readonly number[]).includes(days) ? (days as RangeDays) : 30;
}

export const getOverview = (days: RangeDays) => apiData<Overview>('/admin/analytics/overview', { query: { days } });
export const getTimeseries = (days: RangeDays) => apiData<TimeseriesPoint[]>('/admin/analytics/timeseries', { query: { days } });
export const getRetention = (weeks = 8) => apiData<RetentionCohort[]>('/admin/analytics/retention', { query: { weeks } });
export const getFunnel = (days: RangeDays) => apiData<FunnelStep[]>('/admin/analytics/funnel', { query: { days } });
export const getBreakdown = (days: RangeDays) => apiData<Breakdown>('/admin/analytics/breakdown', { query: { days } });
