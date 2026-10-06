import { describeDevice, displayName, formatChange, formatDate, formatNumber, formatPercent, formatRelative, percentChange } from '@/lib/format';

describe('format helpers', () => {
  it('formats numbers compactly when large', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(64.83)).toBe('64.8');
    expect(formatNumber(12_500)).toBe('12.5K');
  });

  it('formats ratios as percentages', () => {
    expect(formatPercent(0.1912)).toBe('19.1%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0.456, 0)).toBe('46%');
  });

  it('computes period-over-period change', () => {
    expect(percentChange(150, 100)).toBeCloseTo(0.5);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull();
    expect(formatChange(0.537)).toBe('+53.7%');
    expect(formatChange(-0.04)).toBe('−4%');
    expect(formatChange(null)).toBe('new');
  });

  it('shows analytics calendar days in UTC regardless of the viewer timezone', () => {
    expect(formatDate('2026-10-05')).toBe('Oct 5, 2026');
  });

  it('describes relative times', () => {
    const now = Date.parse('2026-06-15T12:00:00Z');
    expect(formatRelative('2026-06-15T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-06-12T12:00:00Z', now)).toBe('3 days ago');
    expect(formatRelative(null)).toBe('Never');
  });

  it('names users and devices', () => {
    expect(displayName({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' })).toBe('Ada Lovelace');
    expect(displayName({ firstName: null, lastName: null, email: 'ada@example.com' })).toBe('ada@example.com');
    expect(displayName({ firstName: null, lastName: null, email: 'deleted+x@deleted.invalid', status: 'DELETED' })).toBe('Deleted account');
    expect(describeDevice('MyApp/1 CFNetwork/1490 Darwin/23')).toBe('iOS');
    expect(describeDevice('okhttp/4.12.0')).toBe('Android');
    expect(describeDevice(null)).toBe('Unknown device');
  });
});
