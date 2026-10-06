import Image from 'next/image';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

/** The brand mark plus (optionally) the product name, driven by src/config/brand.ts. */
export function BrandLogo({ size = 32, showTagline = false, className }: { size?: number; showTagline?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Image src={brand.logo.src} alt={brand.logo.showName ? '' : brand.name} width={size} height={size} className="shrink-0 rounded-md" priority />
      {brand.logo.showName ? (
        <span className="grid leading-tight">
          <span className="truncate font-semibold">{brand.name}</span>
          {showTagline ? <span className="truncate text-xs text-muted-foreground">{brand.tagline}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
