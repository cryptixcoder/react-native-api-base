import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AUDIT_PAGE_SIZE, listAuditLog } from '@/features/audit/api';
import { AuditList } from '@/features/audit/components/audit-list';
import { PaginationLinks } from '@/features/users/components/pagination-links';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditLogPage({ searchParams }: PageProps<'/audit-log'>) {
  await requireAdmin();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const result = await listAuditLog({ page });

  return (
    <>
      <PageHeader title="Audit log" description="Every action taken by an admin, newest first." />
      <Card>
        <CardContent>
          <AuditList entries={result.data} />
        </CardContent>
      </Card>
      <PaginationLinks page={result.page} pageSize={AUDIT_PAGE_SIZE} total={result.total} searchParams={{}} />
    </>
  );
}
