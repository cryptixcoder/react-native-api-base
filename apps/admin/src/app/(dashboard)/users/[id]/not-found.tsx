import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function UserNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <h2 className="font-semibold">User not found</h2>
      <p className="text-sm text-muted-foreground">The account may have been removed, or the link is wrong.</p>
      <Button variant="outline" asChild>
        <Link href="/users">Back to users</Link>
      </Button>
    </div>
  );
}
