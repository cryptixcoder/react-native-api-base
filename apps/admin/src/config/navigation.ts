import { LayoutDashboard, ScrollText, Users, type LucideIcon } from 'lucide-react';

/**
 * Sidebar navigation. To add an admin page: create the route under src/app/(dashboard)/<feature>/
 * and add an entry here. Sections render as labelled groups in the order listed.
 */
export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /users/123) as active. Defaults to true except for "/". */
  matchNested?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: 'Insights',
    items: [{ title: 'Overview', href: '/', icon: LayoutDashboard, matchNested: false }],
  },
  {
    label: 'Manage',
    items: [
      { title: 'Users', href: '/users', icon: Users },
      { title: 'Audit log', href: '/audit-log', icon: ScrollText },
    ],
  },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.matchNested === false || item.href === '/') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
