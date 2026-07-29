import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    // Panneau à part entière : bordure et fond blanc, pour que la table se
    // détache du fond gris au lieu de flotter.
    <div className="relative w-full overflow-x-auto rounded-lg border bg-card">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  // En-tête sur fond teinté et souligné : il se distingue du corps même quand
  // la table défile.
  <thead
    ref={ref}
    className={cn('bg-muted/70 [&_tr]:border-b [&_tr]:border-border', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  // Lignes alternées : sur une grille de notes, l'œil suit la ligne sans la
  // perdre. Les grilles éditables imposent leur propre fond (ligne modifiée,
  // ligne sélectionnée) et neutralisent ce zébrage via `[&>tr]:bg-transparent`.
  <tbody
    ref={ref}
    className={cn('[&>tr:nth-of-type(even)]:bg-muted/40 [&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-border/70 transition-colors hover:bg-accent/40', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 whitespace-nowrap px-2 text-start align-middle text-xs font-semibold uppercase tracking-wide text-foreground/70',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-2 py-1 align-middle', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
