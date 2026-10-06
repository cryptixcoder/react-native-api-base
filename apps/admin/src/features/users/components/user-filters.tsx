'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = 'all';

export function UserFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== ALL) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Debounce typing so the list isn't refetched on every keystroke.
  useEffect(() => {
    if (search === (searchParams.get('search') ?? '')) return;
    const timeout = setTimeout(() => update('search', search.trim() || null), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email or ID" className="pl-8" aria-label="Search users" />
      </div>
      <Select value={searchParams.get('status') ?? ALL} onValueChange={(value) => update('status', value)}>
        <SelectTrigger className="w-36" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="SUSPENDED">Suspended</SelectItem>
          <SelectItem value="DELETED">Deleted</SelectItem>
        </SelectContent>
      </Select>
      <Select value={searchParams.get('role') ?? ALL} onValueChange={(value) => update('role', value)}>
        <SelectTrigger className="w-32" aria-label="Filter by role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All roles</SelectItem>
          <SelectItem value="USER">Users</SelectItem>
          <SelectItem value="ADMIN">Admins</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
