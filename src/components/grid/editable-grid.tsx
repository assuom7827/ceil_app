'use client';

import * as React from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  /**
   * Propriétés les plus récentes, lues à l'intérieur des rendus de cellule.
   *
   * Sans ce détour, `tableColumns` se reconstruirait à CHAQUE frappe (les
   * `columns` du parent dépendent des valeurs saisies). TanStack recréerait
   * alors ses colonnes, démontant et remontant les champs de saisie : la frappe
   * suivante viserait un nœud détaché et serait perdue. Les colonnes restent
   * donc stables tant que leur structure ne change pas.
   */
  const latest = React.useRef({
    columns,
    onChange,
    readOnly,
    selection,
    rowId,
    allSelected,
    handleKeyDown,
    handlePaste,
  });
  latest.current = {
    columns,
    onChange,
    readOnly,
    selection,
    rowId,
    allSelected,
    handleKeyDown,
    handlePaste,
  };

  /** Change uniquement quand la STRUCTURE de la grille change. */
  const structure = `${columns.map((column) => `${column.key}:${column.kind}`).join('|')}#${
    selection ? 'sel' : 'nosel'
  }#${readOnly ? 'ro' : 'rw'}`;

  const buildColumns = (): Array<ColumnDef<TRow>> => {
    const definitions: Array<ColumnDef<TRow>> = [];
    const { selection: selectionRef } = latest.current;

    if (selectionRef) {
      definitions.push({
        id: '__selection',
        header: () => {
          const current = latest.current.selection;
          if (!current) return null;
          return (
            <Checkbox
              checked={latest.current.allSelected}
              onCheckedChange={(checked) => current.onToggleAll(checked === true)}
              aria-label="Tout sélectionner"
            />
          );
        },
        cell: ({ row }) => {
          const current = latest.current.selection;
          if (!current) return null;
          const id = latest.current.rowId(row.original);
          return (
            <Checkbox
              checked={current.selected.has(id)}
              onCheckedChange={(checked) => current.onToggle(id, checked === true)}
              aria-label="Sélectionner la ligne"
            />
          );
        },
      });
    }

    latest.current.columns.forEach((column) => {
      definitions.push({
        id: column.key,
        header: () => column.header,
        cell: ({ row }) => {
          // Les fonctions de la colonne sont relues à chaque rendu : la version
          // capturée à la création des définitions serait figée.
          const live =
            latest.current.columns.find((candidate) => candidate.key === column.key) ?? column;
          const editableColumnsNow = latest.current.columns.filter(isEditable);
          const position: CellRef = {
            row: row.index,
            col: editableColumnsNow.findIndex((candidate) => candidate.key === column.key),
          };
          const value = live.get(row.original);
          const onChangeNow = latest.current.onChange;
          const rowIdNow = latest.current.rowId;

          if (column.kind === 'computed') {
            return (
              <div className={cn('px-2 py-1.5 text-sm', live.align === 'end' && 'text-end')}>
                {live.render ? live.render(row.original) : value}
              </div>
            );
          }

          if (latest.current.readOnly) {
            return (
              <div className={cn('px-2 py-1.5 text-sm', live.align === 'end' && 'text-end')}>
                {live.render ? live.render(row.original) : value || '—'}
              </div>
            );
          }

          if (column.kind === 'select') {
            return (
              <select
                ref={(element) => registerCell(position, element)}
                value={value}
                onChange={(event) =>
                  onChangeNow(rowIdNow(row.original), column.key, event.target.value)
                }
                onKeyDown={(event) => latest.current.handleKeyDown(event, position)}
                className="h-8 w-full rounded border border-transparent bg-transparent px-1 text-sm hover:border-input focus:border-ring focus:outline-none"
              >
                <option value="">—</option>
                {live.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            );
          }

          const error = live.validate?.(value) ?? null;

          return (
            <div>
              <input
                ref={(element) => registerCell(position, element)}
                value={value}
                inputMode={column.kind === 'number' ? 'decimal' : undefined}
                onChange={(event) =>
                  onChangeNow(rowIdNow(row.original), column.key, event.target.value)
                }
                onKeyDown={(event) => latest.current.handleKeyDown(event, position)}
                onPaste={(event) => latest.current.handlePaste(event, position)}
                aria-label={column.header}
                aria-invalid={error !== null}
                className={cn(
                  'h-8 w-full rounded border border-transparent bg-transparent px-1 text-sm',
                  'hover:border-input focus:border-ring focus:outline-none',
                  live.align === 'end' && 'text-end',
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
  };

  /**
   * Mémorisation manuelle : les définitions ne sont reconstruites que si la
   * structure change. `useMemo` ne conviendrait pas — ses dépendances porteraient
   * sur des valeurs qui changent à chaque frappe, exactement ce qu'on évite ici.
   */
  const cache = React.useRef<{ signature: string; definitions: Array<ColumnDef<TRow>> } | null>(
    null,
  );
  if (!cache.current || cache.current.signature !== structure) {
    cache.current = { signature: structure, definitions: buildColumns() };
  }
  const tableColumns = cache.current.definitions;

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
