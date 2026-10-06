import { Badge } from '@/components/ui/badge';
import type { Role, UserStatus } from '@/types/api';

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  SUSPENDED: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  DELETED: 'border-border bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<UserStatus, string> = { ACTIVE: 'Active', SUSPENDED: 'Suspended', DELETED: 'Deleted' };

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return role === 'ADMIN' ? <Badge>Admin</Badge> : null;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? null : (
    <Badge variant="outline" className="text-muted-foreground">
      Unverified
    </Badge>
  );
}
