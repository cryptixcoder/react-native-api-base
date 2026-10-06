import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { listUsers, PAGE_SIZE, parseUserListQuery } from '@/features/users/api';
import { PaginationLinks } from '@/features/users/components/pagination-links';
import { UserFilters } from '@/features/users/components/user-filters';
import { UsersTable } from '@/features/users/components/users-table';
import { requireAdmin } from '@/lib/auth';
import { formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage({ searchParams }: PageProps<'/users'>) {
  await requireAdmin();
  const query = parseUserListQuery(await searchParams);
  const result = await listUsers(query);

  return (
    <>
      <PageHeader title="Users" description={`${formatNumber(result.total)} matching accounts`} />
      <UserFilters />
      <UsersTable users={result.data} />
      <PaginationLinks page={result.page} pageSize={PAGE_SIZE} total={result.total} searchParams={{ search: query.search, status: query.status, role: query.role }} />
    </>
  );
}
