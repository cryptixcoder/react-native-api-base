import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AuditList } from '@/features/audit/components/audit-list';
import { getUser } from '@/features/users/api';
import { ActivityStrip } from '@/features/users/components/activity-strip';
import { RoleBadge, StatusBadge, VerifiedBadge } from '@/features/users/components/user-badges';
import { UserActions } from '@/features/users/components/user-actions';
import { ApiError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth';
import { describeDevice, displayName, formatDate, formatDateTime, formatRelative } from '@/lib/format';

export const metadata: Metadata = { title: 'User' };

async function loadUser(id: string) {
  try {
    return await getUser(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

export default async function UserPage({ params }: PageProps<'/users/[id]'>) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { user, sessions, activity, lastActive, audit } = await loadUser(id);
  const deleted = user.status === 'DELETED';

  return (
    <>
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/users">
          <ArrowLeft /> Users
        </Link>
      </Button>

      <PageHeader
        title={deleted ? 'Deleted account' : displayName(user)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {deleted ? `ID ${user.id}` : user.email}
            <StatusBadge status={user.status} />
            <RoleBadge role={user.role} />
            {!deleted ? <VerifiedBadge verified={Boolean(user.emailVerifiedAt)} /> : null}
          </span>
        }
        actions={<UserActions user={user} currentAdminId={admin.id} />}
      />

      {user.status === 'SUSPENDED' ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="text-sm">
            Suspended {user.suspendedAt ? formatRelative(user.suspendedAt) : ''}
            {user.suspendedReason ? `: “${user.suspendedReason}”` : ''}. The user cannot sign in until reactivated.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <Field label="User ID">
                <span className="font-mono text-xs">{user.id}</span>
              </Field>
              <Field label="Joined">{formatDate(user.createdAt)}</Field>
              <Field label="Last sign-in">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</Field>
              <Field label="Last active">
                {lastActive ? `${formatDate(lastActive.day)}${lastActive.platform ? ` · ${lastActive.platform}` : ''}${lastActive.appVersion ? ` ${lastActive.appVersion}` : ''}` : 'Never'}
              </Field>
              <Field label="Email verified">{user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : 'Not verified'}</Field>
              {deleted && user.deletedAt ? <Field label="Deleted">{formatDateTime(user.deletedAt)}</Field> : null}
            </dl>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Days the user opened the app (UTC)</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityStrip activity={activity} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signed-in devices</CardTitle>
              <CardDescription>Active sessions. Suspending or signing the user out revokes them all.</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not signed in on any device.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>IP address</TableHead>
                      <TableHead>Signed in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{describeDevice(session.userAgent)}</TableCell>
                        <TableCell className="font-mono text-xs">{session.ipAddress ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatRelative(session.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin history</CardTitle>
          <CardDescription>Actions taken on this account</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditList entries={audit} showTarget={false} />
        </CardContent>
      </Card>
    </>
  );
}
