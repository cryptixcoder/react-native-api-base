import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/features/analytics/components/kpi-card';

describe('KpiCard', () => {
  it('shows the value and an improving change in green', () => {
    render(<KpiCard label="Monthly active users" value="330" comparison={{ current: 330, previous: 200 }} />);

    expect(screen.getByText('330')).toBeInTheDocument();
    const change = screen.getByTestId('kpi-change');
    expect(change).toHaveTextContent('+65%');
    expect(change.className).toContain('emerald');
  });

  it('shows a decline in red, or green when lower is better', () => {
    const { rerender } = render(<KpiCard label="Stickiness" value="19%" comparison={{ current: 0.19, previous: 0.2 }} />);
    expect(screen.getByTestId('kpi-change').className).toContain('red');

    rerender(<KpiCard label="Churn" value="2%" comparison={{ current: 0.02, previous: 0.04 }} lowerIsBetter />);
    expect(screen.getByTestId('kpi-change')).toHaveTextContent('−50%');
    expect(screen.getByTestId('kpi-change').className).toContain('emerald');
  });

  it('labels metrics without a baseline as new and omits the badge without a comparison', () => {
    const { rerender } = render(<KpiCard label="Signups" value="5" comparison={{ current: 5, previous: 0 }} />);
    expect(screen.getByTestId('kpi-change')).toHaveTextContent('new');

    rerender(<KpiCard label="Devices" value="9" hint="active sessions" />);
    expect(screen.queryByTestId('kpi-change')).not.toBeInTheDocument();
    expect(screen.getByText('active sessions')).toBeInTheDocument();
  });
});
