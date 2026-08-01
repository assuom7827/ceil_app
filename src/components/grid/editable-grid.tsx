'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
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
 * Champ de saisie d'une cellule.
 *
 * Il conserve sa propre valeur et ne dépend donc PAS de la vitesse à laquelle le
 * reste de la grille se met à jour : la frappe s'affiche immédiatement, tandis
 * que la remontée vers le parent — qui recalcule totaux et statuts sur toutes
 * les lignes — est marquée non urgente. Sans ce découplage, saisir une note sur
 * une session de 150 inscrits décrochait, chaque touche attendant le rendu
 * complet de la grille.
 */
function GridTextCell({
  value,
  label,
  numeric,
  alignEnd,
  error,
  onCommit,
  onKeyDown,
  onPaste,
  registerRef,
}: {
  value: string;
  label: string;
  numeric: boolean;
  alignEnd: boolean;
  error: string | null;
  onCommit: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** Renvoie la valeur appliquée à cette cellule, si le collage l'a touchée. */
  onPaste: (event: React.ClipboardEvent) => string | undefined;
  registerRef: (element: HTMLElement | null) => void;
}) {
  const [local, setLocal] = React.useState(value);
  const focused = React.useRef(false);

  /**
   * Resynchronisation UNIQUEMENT quand le champ n'a pas le focus.
   *
   * Pendant la frappe, la valeur remontée au parent est différée d'un rendu :
   * la prop `value` est donc temporairement en retard. La recopier écraserait
   * les caractères déjà saisis — c'est précisément ce qui faisait perdre des
   * chiffres à la saisie rapide. Hors focus, la prop fait au contraire autorité
   * (rechargement, import, collage sur une autre cellule).
   */
  if (!focused.current && local !== value) setLocal(value);

  return (
    <div>
      <input
        ref={registerRef}
        value={local}
        inputMode={numeric ? 'decimal' : undefined}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onChange={(event) => {
          const next = event.target.value;
          setLocal(next); // urgent : le champ suit la frappe
          React.startTransition(() => onCommit(next)); // différé : colonnes calculées
        }}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          // Le collage multi-cellules est traité par la grille ; elle renvoie
          // la valeur destinée à CETTE cellule, que le champ doit refléter.
          const applied = onPaste(event);
          if (applied !== undefined) setLocal(applied);
        }}
        aria-label={label}
        aria-invalid={error !== null}
        className={cn(
          'h-8 w-full rounded border border-transparent bg-transparent px-1 text-sm',
          'hover:border-input focus:border-ring focus:outline-none',
          alignEnd && 'text-end',
          error && 'border-destructive',
        )}
      />
      {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Ligne mémorisée : elle n'est re-rendue que si SES valeurs changent.
 *
 * `row` et le contexte TanStack restent identiques tant que les données ne
 * bougent pas ; seule l'empreinte `signature` distingue une ligne modifiée.
 */
const MemoizedRow = React.memo(
  function GridRow({
    row,
    selected,
    dirty,
  }: {
    row: Row<unknown>;
    /** Comparée par `React.memo` — non lue dans le rendu. */
    signature: string;
    selected: boolean;
    dirty: boolean;
  }) {
    return (
      <TableRow
        data-state={selected ? 'selected' : undefined}
        // `!` assumé : l'état de la ligne (modifiée, sélectionnée) doit primer
        // sur le zébrage décoratif du corps de table, dont le sélecteur est plus
        // spécifique. Se reposer sur l'ordre des classes serait fragile.
        className={cn(dirty ? '!bg-primary/10' : selected ? '!bg-accent/60' : undefined)}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );
  },
  (previous, next) =>
    previous.row === next.row &&
    previous.signature === next.signature &&
    previous.selected === next.selected &&
    previous.dirty === next.dirty,
);

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
  emptyLabel,
  dirtyRowIds,
}: EditableGridProps<TRow>) {
  const t = useTranslations();
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
    (event: React.ClipboardEvent, position: CellRef): string | undefined => {
      const text = event.clipboardData.getData('text/plain');
      if (!text.includes('\t') && !text.includes('\n')) return undefined; // collage simple

      event.preventDefault();
      const matrix = text
        .replace(/\r/g, '')
        .split('\n')
        .filter((line, index, all) => line.length > 0 || index < all.length - 1)
        .map((line) => line.split('\t'));

      let appliedHere: string | undefined;

      matrix.forEach((cells, rowOffset) => {
        const targetRow = rows[position.row + rowOffset];
        if (!targetRow) return;

        cells.forEach((value, colOffset) => {
          const column = editableColumns[position.col + colOffset];
          if (!column) return;
          const trimmed = value.trim();
          if (rowOffset === 0 && colOffset === 0) appliedHere = trimmed;
          onChange(rowId(targetRow), column.key, trimmed);
        });
      });

      return appliedHere;
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
              aria-label={t('common.selectAll')}
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
              aria-label={t('common.selectRow')}
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

          return (
            <GridTextCell
              value={value}
              label={column.header}
              numeric={column.kind === 'number'}
              alignEnd={live.align === 'end'}
              error={live.validate?.(value) ?? null}
              onCommit={(next) => onChangeNow(rowIdNow(row.original), column.key, next)}
              onKeyDown={(event) => latest.current.handleKeyDown(event, position)}
              onPaste={(event) => latest.current.handlePaste(event, position)}
              registerRef={(element) => registerCell(position, element)}
            />
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

  /**
   * Empreinte des valeurs affichées d'une ligne, colonnes calculées comprises.
   *
   * C'est elle qui décide si la ligne doit être re-rendue. Sans cela, une frappe
   * dans une cellule re-rendrait TOUTES les lignes : sur une session de 150
   * inscrits, cela représente plus de mille champs reconstruits à chaque touche,
   * et la saisie décroche.
   */
  const rowSignature = (row: TRow): string =>
    latest.current.columns.map((column) => column.get(row)).join('');

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel ?? t('common.noLines')}</p>;
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
        {table.getRowModel().rows.map((row) => {
          const id = rowId(row.original);
          return (
            <MemoizedRow
              key={row.id}
              row={row as Row<unknown>}
              signature={rowSignature(row.original)}
              selected={selection?.selected.has(id) ?? false}
              dirty={dirtyRowIds?.has(id) ?? false}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}
