import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/format';
import type { UserDetail } from '@/types/api';

const DAYS = 30;

/** One square per day for the last 30 UTC days; filled when the user was active. */
export function ActivityStrip({ activity, now = new Date() }: { activity: UserDetail['activity']; now?: Date }) {
  const byDay = new Map(activity.map((row) => [row.day, row]));
  const days = Array.from({ length: DAYS }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (DAYS - 1 - index)));
    return date.toISOString().slice(0, 10);
  });

  return (
    <div className="grid gap-2">
      <div className="flex gap-1" role="img" aria-label={`Active on ${activity.length} of the last ${DAYS} days`}>
        {days.map((day) => {
          const row = byDay.get(day);
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <span className={`h-6 flex-1 rounded-sm ${row ? 'bg-primary' : 'bg-muted'}`} />
              </TooltipTrigger>
              <TooltipContent>
                {formatDate(day)}
                {row ? ` · active${row.platform ? ` on ${row.platform}` : ''}${row.appVersion ? ` ${row.appVersion}` : ''}` : ' · inactive'}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Active on {activity.length} of the last {DAYS} days
      </p>
    </div>
  );
}
