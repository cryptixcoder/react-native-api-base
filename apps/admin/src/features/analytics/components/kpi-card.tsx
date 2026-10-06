import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatChange, percentChange } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  label: string;
  value: string;
  /** Current and previous raw values; renders a change badge when provided. */
  comparison?: { current: number; previous: number };
  /** For metrics where going down is good (e.g. churn). */
  lowerIsBetter?: boolean;
  hint?: string;
  /** How the metric is calculated, shown on hover. */
  definition?: string;
}

export function KpiCard({ label, value, comparison, lowerIsBetter = false, hint, definition }: KpiCardProps) {
  const change = comparison ? percentChange(comparison.current, comparison.previous) : undefined;
  const direction = change === undefined || change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
  const good = direction === 'flat' ? null : (direction === 'up') !== lowerIsBetter;
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardDescription>
          {definition ? (
            <Tooltip>
              <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">{label}</TooltipTrigger>
              <TooltipContent className="max-w-64">{definition}</TooltipContent>
            </Tooltip>
          ) : (
            label
          )}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
        {change !== undefined ? (
          <span
            data-testid="kpi-change"
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
              good === true && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              good === false && 'bg-red-500/10 text-red-600 dark:text-red-400',
              good === null && 'bg-muted',
            )}
          >
            <Icon className="size-3" />
            {formatChange(change)}
          </span>
        ) : null}
        <span>{hint ?? (change !== undefined ? 'vs previous period' : '')}</span>
      </CardContent>
    </Card>
  );
}
