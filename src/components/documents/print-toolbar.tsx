'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Barre d'action des pages imprimables. Masquée à l'impression (`no-print`)
 * pour ne pas apparaître sur le papier.
 */
export function PrintToolbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="no-print sticky top-0 z-10 mb-6 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.close()}>
            Fermer
          </Button>
          <Button onClick={() => window.print()}>
            <Printer />
            Imprimer
          </Button>
        </div>
      </div>
    </div>
  );
}
