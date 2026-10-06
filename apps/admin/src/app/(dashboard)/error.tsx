'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <div className="grid gap-1">
        <h2 className="font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error.message || 'The API could not be reached.'}</p>
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
