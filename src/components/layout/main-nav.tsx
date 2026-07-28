'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav';

export function MainNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav aria-label="Navigation principale" className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Écran à venir"
              className="cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50"
            >
              {t(item.labelKey)}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
