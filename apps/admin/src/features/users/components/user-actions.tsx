'use client';

import { Ban, LogOut, MailCheck, MailPlus, MoreHorizontal, RotateCcw, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as actions from '@/features/users/actions';
import { DeleteUserDialog } from '@/features/users/components/delete-user-dialog';
import { SuspendUserDialog } from '@/features/users/components/suspend-user-dialog';
import type { AdminUser } from '@/types/api';

/** Account actions for the user detail page. The API enforces the same rules; this only hides what can't apply. */
export function UserActions({ user, currentAdminId }: { user: AdminUser; currentAdminId: string }) {
  const [dialog, setDialog] = useState<'suspend' | 'delete' | null>(null);
  const [pending, startTransition] = useTransition();
  const isSelf = user.id === currentAdminId;

  if (user.status === 'DELETED') return null;

  function run(action: () => Promise<actions.ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <>
      {user.status === 'SUSPENDED' ? (
        <Button variant="outline" disabled={pending} onClick={() => run(() => actions.unsuspendUser(user.id))}>
          <RotateCcw /> Reactivate
        </Button>
      ) : (
        <Button variant="outline" disabled={pending || isSelf} onClick={() => setDialog('suspend')}>
          <Ban /> Suspend
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem disabled={user.status !== 'ACTIVE'} onSelect={() => run(() => actions.revokeSessions(user.id))}>
            <LogOut /> Sign out of all devices
          </DropdownMenuItem>
          {!user.emailVerifiedAt ? (
            <>
              <DropdownMenuItem disabled={user.status !== 'ACTIVE'} onSelect={() => run(() => actions.resendVerification(user.id))}>
                <MailPlus /> Resend verification email
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run(() => actions.verifyEmail(user.id))}>
                <MailCheck /> Mark email as verified
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Access</DropdownMenuLabel>
          {user.role === 'ADMIN' ? (
            <DropdownMenuItem disabled={isSelf} onSelect={() => run(() => actions.setRole(user.id, 'USER'))}>
              <ShieldOff /> Remove admin access
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={user.status !== 'ACTIVE'} onSelect={() => run(() => actions.setRole(user.id, 'ADMIN'))}>
              <ShieldCheck /> Make admin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={isSelf} onSelect={() => setDialog('delete')}>
            <Trash2 /> Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SuspendUserDialog open={dialog === 'suspend'} onOpenChange={(open) => setDialog(open ? 'suspend' : null)} onConfirm={(reason) => actions.suspendUser(user.id, reason)} />
      <DeleteUserDialog email={user.email} open={dialog === 'delete'} onOpenChange={(open) => setDialog(open ? 'delete' : null)} onConfirm={() => actions.deleteUser(user.id)} />
    </>
  );
}
