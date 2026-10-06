import Link from 'next/link';
import { describeAuditEntry } from '@/features/audit/describe';
import { formatDateTime } from '@/lib/format';
import type { AuditEntry } from '@/types/api';

/** Timeline of admin actions. `showTarget` adds a link to the affected user (hidden on a user's own page). */
export function AuditList({ entries, showTarget = true }: { entries: AuditEntry[]; showTarget?: boolean }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No admin actions recorded yet.</p>;
  }

  return (
    <ol className="grid gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="grid gap-0.5 border-l-2 border-primary/40 pl-3 text-sm">
          <span className="font-medium">{describeAuditEntry(entry)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(entry.createdAt)} · by {entry.actor?.email ?? 'a removed admin'}
            {showTarget && entry.target ? (
              <>
                {' '}
                · user{' '}
                <Link href={`/users/${entry.target.id}`} className="underline underline-offset-4 hover:text-foreground">
                  {entry.target.status === 'DELETED' ? entry.target.id : entry.target.email}
                </Link>
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
