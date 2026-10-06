'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The ring chart's animated center number (@number-flow/react) renders a custom element that can't be
 * hydrated from server HTML, so the chart is rendered on the client only.
 */
export const PlatformRing = dynamic(() => import('./platform-ring-chart').then((mod) => mod.PlatformRingChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-xl" />,
});
