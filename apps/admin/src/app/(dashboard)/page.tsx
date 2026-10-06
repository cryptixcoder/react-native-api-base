import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { parseRange } from '@/features/analytics/api';
import { RangeSelect } from '@/features/analytics/components/range-select';
import { DashboardWidgets } from '@/features/analytics/widgets';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage({ searchParams }: PageProps<'/'>) {
  await requireAdmin();
  const days = parseRange((await searchParams).days);

  return (
    <>
      <PageHeader title="Overview" description="How your app is growing, engaging and retaining users. All days are UTC." actions={<RangeSelect value={days} />} />
      <DashboardWidgets days={days} />
    </>
  );
}
