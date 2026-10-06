'use client';

import { Ring } from '@/components/charts/ring';
import { RingCenter } from '@/components/charts/ring-center';
import { RingChart } from '@/components/charts/ring-chart';
import { formatNumber, formatPercent } from '@/lib/format';
import type { Breakdown } from '@/types/api';

const LABELS: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web', other: 'Other', unknown: 'Unknown' };
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function PlatformRingChart({ platforms }: { platforms: Breakdown['platforms'] }) {
  const total = platforms.reduce((sum, row) => sum + row.users, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity in this period yet.</p>;
  }

  const data = platforms.map((row, index) => ({
    label: LABELS[row.platform] ?? row.platform,
    value: row.users,
    maxValue: total,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
      <RingChart data={data} size={220} strokeWidth={14} ringGap={6} baseInnerRadius={44}>
        {data.map((item, index) => (
          <Ring key={item.label} index={index} />
        ))}
        <RingCenter defaultLabel="Active users" />
      </RingChart>
      <ul className="grid gap-2 text-sm">
        {data.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <span className="tabular-nums">
              {formatNumber(item.value)} <span className="text-muted-foreground">· {formatPercent(item.value / total, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
