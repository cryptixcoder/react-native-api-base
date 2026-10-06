import type { AuditEntry } from '@/types/api';

/** Human-readable descriptions for audit actions. Add an entry when you add a new admin action. */
const DESCRIPTIONS: Record<string, (metadata: Record<string, unknown>) => string> = {
  'user.suspended': (m) => `Suspended the account${m.reason ? `: “${String(m.reason)}”` : ''}`,
  'user.unsuspended': () => 'Reactivated the account',
  'user.sessions_revoked': (m) => `Signed the user out of ${Number(m.revoked ?? 0)} device(s)`,
  'user.email_verified': () => 'Marked the email as verified',
  'user.verification_resent': () => 'Resent the verification email',
  'user.role_changed': (m) => `Changed role from ${String(m.from).toLowerCase()} to ${String(m.to).toLowerCase()}`,
  'user.deleted': () => 'Deleted and anonymized the account',
};

export function describeAuditEntry(entry: Pick<AuditEntry, 'action' | 'metadata'>): string {
  const describe = DESCRIPTIONS[entry.action];
  return describe ? describe(entry.metadata ?? {}) : entry.action;
}
