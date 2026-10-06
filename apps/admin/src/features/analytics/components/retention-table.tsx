import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import type { RetentionCohort } from '@/types/api';

/** Weekly cohort retention, tinted with the primary chart color by retention rate. */
export function RetentionTable({ cohorts }: { cohorts: RetentionCohort[] }) {
  const weeks = cohorts[0]?.retention.length ?? 0;

  if (cohorts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No signups in this period yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-28">Signup week</TableHead>
            <TableHead className="text-right">Users</TableHead>
            {Array.from({ length: weeks }, (_, week) => (
              <TableHead key={week} className="text-center">
                Week {week}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...cohorts].reverse().map((cohort) => (
            <TableRow key={cohort.cohort} className="hover:bg-transparent">
              <TableCell className="font-medium">{formatDate(cohort.cohort)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(cohort.size)}</TableCell>
              {cohort.retention.map((value, week) => (
                <TableCell key={week} className="p-0.5 text-center">
                  {value === null ? null : (
                    <span
                      className="block rounded-sm px-1 py-1.5 tabular-nums"
                      style={{
                        backgroundColor: `color-mix(in oklch, var(--chart-1) ${Math.round(value * 85) + 5}%, transparent)`,
                        color: value > 0.5 ? 'var(--brand-foreground)' : undefined,
                      }}
                    >
                      {formatPercent(value, 0)}
                    </span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
