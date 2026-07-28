'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface GridColumn<TRow> {
  key: string;
  header: string;
  /** `computed` = colonne calculée, toujours en lecture seule. */
  kind: 'text' | 'number' | 'select' | 'computed';
  /** Valeur brute éditée (chaîne vide pour « non saisi »). */
  get: (row: TRow) => string;
  /** Rendu des colonnes calculées ou en lecture seule. */
  render?: (row: TRow) => React.ReactNode;
  options?: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
  align?: 'start' | 'end';
  /** Message d'erreur de validation, affiché sous la cellule. */
  validate?: (value: string) => string | null;
}

export interface GridSelection {
  selected: ReadonlySet<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}

export interface EditableGridProps<TRow> {
  rows: readonly TRow[];
  rowId: (row: TRow) => string;
  columns: ReadonlyArray<GridColumn<TRow>>;
  onChange: (rowId: string, columnKey: string, value: string) => void;
  /** Grille figée : session ou test verrouillé. */
  readOnly?: boolean;
  selection?: GridSelection;
  emptyLabel?: string;
  /** Identifiants des lignes modifiées et non encore enregistrées. */
  dirtyRowIds?: ReadonlySet<string>;
}

/** Position d'une cellule éditable dans la matrice de navigation. */
interface CellRef {
  row: number;
  col: number;
}

function isEditable<TRow>(column: GridColumn<TRow>): boolean {
  return column.kind !== 'computed';
}

/**
 * Grille de saisie type tableur.
 *
 * Trois exigences la distinguent d'un simple tableau :
 *   — navigation clavier (Entrée / flèches) pour saisir sans quitter le clavier ;
 *   — collage multi-cellules depuis Excel, en une seule opération ;
 *   — colonnes calculées mises à jour en direct par les MÊMES fonctions
 *     dérivées que le serveur, importées depuis `services/derive`.
 */
export function EditableGrid<TRow>({
  rows,
  rowId,
  columns,
  onChange,
  readOnly = false,
  selection,
  emptyLabel = 'Aucune ligne.',
  dirtyRowIds,
}: EditableGridProps<TRow>) {
  const inputs = React.useRef(new Map<string, HTMLElement>());
  const editableColumns = React.useMemo(() => columns.filter(isEditable), [columns]);

  const registerCell = React.useCallback((position: CellRef, element: HTMLElement | null) => {
    const key = `${position.row}:${position.col}`;
    if (element) inputs.current.set(key, element);
    else inputs.current.delete(key);
  }, []);

  const focusCell = React.useCallback((position: CellRef) => {
    const element = inputs.current.get(`${position.row}:${position.col}`);
    if (element) {
      element.focus();
      if (element instanceof HTMLInputElement) element.select();
    }
  }, []);

  const move = React.useCallback(
    (from: CellRef, deltaRow: number, deltaCol: number) => {
      const row = Math.min(Math.max(from.row + deltaRow, 0), rows.length - 1);
      const col = Math.min(Math.max(from.col + deltaCol, 0), editableColumns.length - 1);
      focusCell({ row, col });
    },
    [editableColumns.length, focusCell, rows.length],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, position: CellRef) => {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          move(position, event.shiftKey ? -1 : 1, 0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          move(position, 1, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          move(position, -1, 0);
          break;
        default:
          break;
      }
    },
    [move],
  );

  /**
   * Collage depuis Excel : le presse-papiers arrive en TSV. On remplit à partir
   * de la cellule courante, vers la droite et vers le bas, en s'arrêtant aux
   * bords de la grille. Les colonnes calculées sont sautées : elles ne se
   * saisissent pas.
   */
  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent, position: CellRef) => {
      const text = event.clipboardData.getData('text/plain');
      if (!text.includes('\t') && !text.includes('\n')) return; // collage simple

      event.preventDefault();
      const matrix = text
        .replace(/\r/g, '')
        .split('\n')
        .filter((line, index, all) => line.length > 0 || index < all.length - 1)
        .map((line) => line.split('\t'));

      matrix.forEach((cells, rowOffset) => {
        const targetRow = rows[position.row + rowOffset];
        if (!targetRow) return;

        cells.forEach((value, colOffset) => {
          const column = editableColumns[position.col + colOffset];
          if (!column) return;
          onChange(rowId(targetRow), column.key, value.trim());
        });
      });
    },
    [editableColumns, onChange, rowId, rows],
  );

  const allSelected =
    selection !== undefined && rows.length > 0 && selection.selected.size === rows.length;

  const tableColumns = React.useMemo<Array<ColumnDef<TRow>>>(() => {
    const definitions: Array<ColumnDef<TRow>> = [];

    if (selection) {
      definitions.push({
        id: '__selection',
        header: () => (
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => selection.onToggleAll(checked === true)}
            aria-label="Tout sélectionner"
          />
        ),
        cell: ({ row }) => {
          const id = rowId(row.original);
          return (
            <Checkbox
              checked={selection.selected.has(id)}
              onCheckedChange={(checked) => selection.onToggle(id, checked === true)}
              aria-label="Sélectionner la ligne"
            />
          );
        },
      });
    }

    columns.forEach((column) => {
      definitions.push({
        id: column.key,
        header: () => column.header,
        cell: ({ row }) => {
          const editableIndex = editableColumns.indexOf(column);
          const position: CellRef = { row: row.index, col: editableIndex };
          const value = column.get(row.original);

          if (column.kind === 'computed') {
            return (
              <div className={cn('px-2 py-1.5 text-sm', column.align === 'end' && 'text-end')}>
                {column.render ? column.render(row.original) : value}
              </div>
            );
          }

          if (readOnly) {
            return (
              <div className={cn('px-2 py-1.5 text-sm', column.align === 'end' && 'text-end')}>
                {column.render ? column.render(row.original) : value || '—'}
              </div>
            );
          }

          if (column.kind === 'select') {
            return (
              <select
                ref={(element) => registerCell(position, element)}
                value={value}
                onChange={(event) => onChange(rowId(row.original), column.key, event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, position)}
                className="h-8 w-full rounded border border-transparent bg-transparent px-1 text-sm hover:border-input focus:border-ring focus:outline-none"
              >
                <option value="">—</option>
                {column.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            );
          }

          const error = column.validate?.(value) ?? null;

          return (
            <div>
              <input
                ref={(element) => registerCell(position, element)}
                value={value}
                inputMode={column.kind === 'number' ? 'decimal' : undefined}
                onChange={(event) => onChange(rowId(row.original), column.key, event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, position)}
                onPaste={(event) => handlePaste(event, position)}
                aria-label={column.header}
                aria-invalid={error !== null}
                className={cn(
                  'h-8 w-full rounded border border-transparent bg-transparent px-1 text-sm',
                  'hover:border-input focus:border-ring focus:outline-none',
                  column.align === 'end' && 'text-end',
                  error && 'border-destructive',
                )}
              />
              {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
            </div>
          );
        },
      });
    });

    return definitions;
  }, [
    allSelected,
    columns,
    editableColumns,
    handleKeyDown,
    handlePaste,
    onChange,
    readOnly,
    registerCell,
    rowId,
    selection,
  ]);

  const table = useReactTable({
    data: rows as TRow[],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>

      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className={cn(dirtyRowIds?.has(rowId(row.original)) && 'bg-primary/5')}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
