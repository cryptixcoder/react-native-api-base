'use server';

import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth';
import type { Role } from '@/types/api';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Every action re-checks that the caller is an admin (server actions are public endpoints), calls the
 * API, and refreshes the page so it shows the new state. The API enforces the real rules (no acting on
 * yourself, last-admin protection) and writes the audit log.
 */
async function adminAction(path: string, init: Parameters<typeof apiFetch>[1], message: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    await apiFetch(path, init);
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }

  refresh();
  return { ok: true, message };
}

const userPath = (id: string, action = '') => `/admin/users/${encodeURIComponent(id)}${action}`;

export async function suspendUser(id: string, reason: string) {
  return adminAction(userPath(id, '/suspend'), { method: 'POST', body: { reason } }, 'User suspended and signed out everywhere');
}

export async function unsuspendUser(id: string) {
  return adminAction(userPath(id, '/unsuspend'), { method: 'POST' }, 'User reactivated');
}

export async function revokeSessions(id: string) {
  return adminAction(userPath(id, '/revoke-sessions'), { method: 'POST' }, 'User signed out of all devices');
}

export async function verifyEmail(id: string) {
  return adminAction(userPath(id, '/verify-email'), { method: 'POST' }, 'Email marked as verified');
}

export async function resendVerification(id: string) {
  return adminAction(userPath(id, '/resend-verification'), { method: 'POST' }, 'Verification email sent');
}

export async function setRole(id: string, role: Role) {
  return adminAction(userPath(id, '/role'), { method: 'PATCH', body: { role } }, role === 'ADMIN' ? 'User is now an admin' : 'Admin access removed');
}

export async function deleteUser(id: string) {
  return adminAction(userPath(id), { method: 'DELETE' }, 'Account deleted and anonymized');
}
