'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart } from '@/components/charts/area-chart';
import { Grid } from '@/components/charts/grid';
import { ChartTooltip } from '@/components/charts/tooltip';
import { XAxis } from '@/components/charts/x-axis';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/format';
import type { TimeseriesPoint } from '@/types/api';

const METRICS = {
  activeUsers: { label: 'Active users', color: 'var(--chart-1)' },
  signups: { label: 'Signups', color: 'var(--chart-2)' },
} as const;

type Metric = keyof typeof METRICS;

export function GrowthChart({ data }: { data: TimeseriesPoint[] }) {
  const [metric, setMetric] = useState<Metric>('activeUsers');
  // Today (UTC) is still in progress, so plotting it would show a misleading drop at the end.
  // Dates are built at local midnight so axis labels show the same calendar day as the UTC day string.
  const chartData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return data
      .filter((point) => point.date !== today)
      .map((point) => {
        const [year, month, day] = point.date.split('-').map(Number);
        return { ...point, date: new Date(year!, month! - 1, day!) };
      });
  }, [data]);
  const total = chartData.reduce((sum, point) => sum + point[metric], 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={metric} onValueChange={(value) => setMetric(value as Metric)}>
          <TabsList>
            {(Object.keys(METRICS) as Metric[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {METRICS[key].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          {metric === 'signups' ? `${formatNumber(total)} signups in range` : `${formatNumber(total / Math.max(chartData.length, 1))} per day on average`}
        </p>
      </div>
      <AreaChart key={metric} data={chartData} aspectRatio="3 / 1" margin={{ top: 16, right: 16, bottom: 32, left: 16 }}>
        <Grid horizontal />
        <Area dataKey={metric} fill={METRICS[metric].color} />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  );
}
