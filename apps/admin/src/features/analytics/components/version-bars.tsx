'use client';

import { Bar } from '@/components/charts/bar';
import { BarChart } from '@/components/charts/bar-chart';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { ChartTooltip } from '@/components/charts/tooltip';
import type { Breakdown } from '@/types/api';

/** Active users per app version, oldest to newest left-to-right where versions sort. */
export function VersionBars({ versions }: { versions: Breakdown['appVersions'] }) {
  if (versions.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity in this period yet.</p>;
  }

  const data = [...versions]
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
    .map((row) => ({ name: row.version === 'unknown' ? 'n/a' : row.version, users: row.users }));

  return (
    <BarChart data={data} xDataKey="name" aspectRatio="4 / 1" margin={{ top: 16, right: 16, bottom: 32, left: 16 }}>
      <Grid horizontal />
      <Bar dataKey="users" fill="var(--chart-1)" />
      <BarXAxis showAllLabels />
      <ChartTooltip showDatePill={false} />
    </BarChart>
  );
}
