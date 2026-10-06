import { isActive, navigation } from '@/config/navigation';
import { describeAuditEntry } from '@/features/audit/describe';

describe('audit descriptions', () => {
  it('describes known actions with their metadata', () => {
    expect(describeAuditEntry({ action: 'user.suspended', metadata: { reason: 'Spam' } })).toBe('Suspended the account: “Spam”');
    expect(describeAuditEntry({ action: 'user.role_changed', metadata: { from: 'USER', to: 'ADMIN' } })).toBe('Changed role from user to admin');
    expect(describeAuditEntry({ action: 'user.sessions_revoked', metadata: { revoked: 2 } })).toBe('Signed the user out of 2 device(s)');
  });

  it('falls back to the raw action name', () => {
    expect(describeAuditEntry({ action: 'billing.refunded', metadata: null })).toBe('billing.refunded');
  });
});

describe('navigation', () => {
  const [overview, users] = [navigation[0]!.items[0]!, navigation[1]!.items[0]!];

  it('matches nested routes except for the overview', () => {
    expect(isActive(users, '/users/abc')).toBe(true);
    expect(isActive(users, '/users')).toBe(true);
    expect(isActive(overview, '/')).toBe(true);
    expect(isActive(overview, '/users')).toBe(false);
  });
});
