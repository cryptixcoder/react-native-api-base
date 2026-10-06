import { getOverview, type RangeDays } from '@/features/analytics/api';
import { KpiCard } from '@/features/analytics/components/kpi-card';
import { formatNumber, formatPercent } from '@/lib/format';

export async function KpiGrid({ days }: { days: RangeDays }) {
  const overview = await getOverview(days);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total users"
        value={formatNumber(overview.users.total)}
        hint={`${formatNumber(overview.users.suspended)} suspended · ${formatNumber(overview.users.deleted)} deleted`}
        definition="Accounts that are active or suspended. Deleted accounts are excluded."
      />
      <KpiCard label={`New signups (${days}d)`} value={formatNumber(overview.newUsers.current)} comparison={overview.newUsers} definition="Accounts created in the selected range." />
      <KpiCard
        label="Daily active users"
        value={formatNumber(overview.dau.current)}
        comparison={overview.dau}
        definition="Average number of users active per day over the selected range."
      />
      <KpiCard label="Weekly active users" value={formatNumber(overview.wau.current)} comparison={overview.wau} hint="vs previous 7 days" definition="Distinct users active in the last 7 days." />
      <KpiCard label="Monthly active users" value={formatNumber(overview.mau.current)} comparison={overview.mau} hint="vs previous 30 days" definition="Distinct users active in the last 30 days." />
      <KpiCard
        label="Stickiness"
        value={formatPercent(overview.stickiness.current)}
        comparison={overview.stickiness}
        hint="DAU ÷ MAU"
        definition="Average daily active users divided by monthly active users. 20%+ is healthy for most consumer apps."
      />
      <KpiCard
        label="Email verification"
        value={formatPercent(overview.verificationRate.current)}
        comparison={overview.verificationRate}
        definition="Share of users who signed up in the range and verified their email."
      />
      <KpiCard label="Signed-in devices" value={formatNumber(overview.activeSessions)} hint="active sessions right now" definition="Unexpired, unrevoked sessions. One per signed-in device." />
    </div>
  );
}
