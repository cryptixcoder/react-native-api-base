'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ActionResult } from '@/features/users/actions';

interface SuspendUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<ActionResult>;
}

export function SuspendUserDialog({ open, onOpenChange, onConfirm }: SuspendUserDialogProps) {
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onConfirm(reason.trim());
      if (result.ok) {
        toast.success(result.message);
        setReason('');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Suspend this account</DialogTitle>
            <DialogDescription>The user is signed out of every device immediately and cannot sign in until the account is reactivated.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="suspend-reason">Reason (recorded in the audit log)</Label>
            <Textarea id="suspend-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Reported for spam" required minLength={3} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={reason.trim().length < 3 || pending}>
              {pending ? 'Suspending…' : 'Suspend account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
