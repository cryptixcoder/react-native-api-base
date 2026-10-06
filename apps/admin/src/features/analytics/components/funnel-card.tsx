'use client';

import { FunnelChart } from '@/components/charts/funnel-chart';
import { formatNumber, formatPercent } from '@/lib/format';
import type { FunnelStep } from '@/types/api';

export function ActivationFunnel({ steps }: { steps: FunnelStep[] }) {
  const registered = steps[0]?.users ?? 0;

  if (registered === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No signups in this period yet.</p>;
  }

  return (
    <div className="grid gap-4">
      <FunnelChart
        data={steps.map((step) => ({ label: step.step, value: step.users, displayValue: formatNumber(step.users) }))}
        color="var(--chart-1)"
        layers={3}
        formatPercentage={(pct) => formatPercent(pct / 100, 0)}
      />
      <ol className="grid gap-1 text-sm sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.step} className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">
              {index + 1}. {step.step}
            </span>
            <span className="font-medium tabular-nums">
              {formatNumber(step.users)} <span className="text-muted-foreground">({formatPercent(step.users / registered, 0)})</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
