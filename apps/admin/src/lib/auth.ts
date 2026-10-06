import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';
import { apiFetch } from '@/lib/api';
import type { CurrentUser } from '@/types/api';

/**
 * The signed-in admin, verified against the API (deduplicated per request).
 *
 * Call this at the top of every page, layout and server action that needs an admin. The proxy only
 * keeps tokens fresh; it is not an authorization check (server actions can be invoked directly).
 */
export const requireAdmin = cache(async (): Promise<CurrentUser> => {
  const { user } = await apiFetch<{ user: CurrentUser }>('/auth/me');

  if (user.role !== 'ADMIN') {
    redirect('/login?reason=forbidden');
  }

  return user;
});
