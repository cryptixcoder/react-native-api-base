import Link from 'next/link';
import { RoleBadge, StatusBadge, VerifiedBadge } from '@/features/users/components/user-badges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { displayName, formatDate, formatRelative } from '@/lib/format';
import type { AdminUser } from '@/types/api';

export function UsersTable({ users }: { users: AdminUser[] }) {
  if (users.length === 0) {
    return <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No users match these filters.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Joined</TableHead>
            <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="relative">
              <TableCell>
                {/* The link covers the whole row so any cell opens the user. */}
                <Link href={`/users/${user.id}`} className="grid max-w-[55vw] gap-0.5 after:absolute after:inset-0 md:max-w-md">
                  <span className="truncate font-medium">{displayName(user)}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.status === 'DELETED' ? `ID ${user.id}` : user.email}</span>
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={user.status} />
                  <RoleBadge role={user.role} />
                  {user.status === 'ACTIVE' ? <VerifiedBadge verified={Boolean(user.emailVerifiedAt)} /> : null}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(user.createdAt)}</TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{formatRelative(user.lastLoginAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
