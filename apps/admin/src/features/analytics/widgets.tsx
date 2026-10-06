import { Suspense, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getBreakdown, getFunnel, getRetention, getTimeseries, type RangeDays } from '@/features/analytics/api';
import { ActivationFunnel } from '@/features/analytics/components/funnel-card';
import { GrowthChart } from '@/features/analytics/components/growth-chart';
import { KpiGrid } from '@/features/analytics/components/kpi-grid';
import { PlatformRing } from '@/features/analytics/components/platform-ring';
import { RetentionTable } from '@/features/analytics/components/retention-table';
import { VersionBars } from '@/features/analytics/components/version-bars';
import { cn } from '@/lib/utils';

/**
 * The overview page renders these widgets in order. Add, remove or reorder entries to customize the
 * dashboard for a project. Each widget loads its own data and streams in independently.
 *
 * - `card: false` renders the widget bare (e.g. the KPI grid, which is its own set of cards).
 * - `span` controls the width on large screens.
 */
export interface DashboardWidget {
  id: string;
  title?: string;
  description?: string;
  span: 'full' | 'half';
  card?: boolean;
  /** Async server component that fetches its data and renders. */
  render: (props: { days: RangeDays }) => ReactNode;
  /** Shown while the widget loads. */
  skeletonHeight?: number;
}

export const dashboardWidgets: DashboardWidget[] = [
  {
    id: 'kpis',
    span: 'full',
    card: false,
    skeletonHeight: 260,
    render: ({ days }) => <KpiGrid days={days} />,
  },
  {
    id: 'growth',
    title: 'Growth',
    description: 'Daily active users and new signups (complete UTC days)',
    span: 'full',
    skeletonHeight: 320,
    render: async ({ days }) => <GrowthChart data={await getTimeseries(days)} />,
  },
  {
    id: 'retention',
    title: 'Weekly retention',
    description: 'Share of each signup cohort that was active in the weeks after signing up',
    span: 'full',
    skeletonHeight: 320,
    render: async () => <RetentionTable cohorts={await getRetention(8)} />,
  },
  {
    id: 'funnel',
    title: 'Activation funnel',
    description: 'Users who signed up in this period. Each step counts users who also completed the previous one.',
    span: 'half',
    skeletonHeight: 300,
    render: async ({ days }) => <ActivationFunnel steps={await getFunnel(days)} />,
  },
  {
    id: 'platforms',
    title: 'Platforms',
    description: 'Active users by platform',
    span: 'half',
    skeletonHeight: 300,
    render: async ({ days }) => <PlatformRing platforms={(await getBreakdown(days)).platforms} />,
  },
  {
    id: 'versions',
    title: 'App versions',
    description: 'Active users by app version: see when it is safe to drop old releases',
    span: 'full',
    skeletonHeight: 300,
    render: async ({ days }) => <VersionBars versions={(await getBreakdown(days)).appVersions} />,
  },
];

export function DashboardWidgets({ days, widgets = dashboardWidgets }: { days: RangeDays; widgets?: DashboardWidget[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {widgets.map((widget) => {
        const content = (
          <Suspense fallback={<Skeleton className="w-full rounded-xl" style={{ height: widget.skeletonHeight ?? 240 }} />}>
            {widget.render({ days })}
          </Suspense>
        );

        return (
          <section key={widget.id} aria-label={widget.title ?? widget.id} className={cn(widget.span === 'full' && 'lg:col-span-2')}>
            {widget.card === false ? (
              content
            ) : (
              <Card className="h-full">
                {widget.title ? (
                  <CardHeader>
                    <CardTitle>{widget.title}</CardTitle>
                    {widget.description ? <CardDescription>{widget.description}</CardDescription> : null}
                  </CardHeader>
                ) : null}
                <CardContent>{content}</CardContent>
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
