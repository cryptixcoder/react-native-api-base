'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionResult } from '@/features/users/actions';

interface DeleteUserDialogProps {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<ActionResult>;
}

/** Deleting is irreversible, so the admin must type the account's email to confirm. */
export function DeleteUserDialog({ email, open, onOpenChange, onConfirm }: DeleteUserDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const [pending, startTransition] = useTransition();
  const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

  function handleDelete() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmation('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this account?</AlertDialogTitle>
          <AlertDialogDescription>
            The user is signed out everywhere and their name, email and password are permanently erased. Anonymous usage history is kept for analytics. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="confirm-email" className="block leading-relaxed font-normal">
            Type <span className="font-mono font-semibold break-all">{email}</span> to confirm
          </Label>
          <Input id="confirm-email" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={!matches || pending} onClick={handleDelete}>
            {pending ? 'Deleting…' : 'Delete account'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
