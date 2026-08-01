'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import {
  displayValue,
  readPath,
  type ColumnDef,
  type FieldDef,
  type ResourceRecord,
} from './fields';
import { ResourceForm, toFieldErrors } from './resource-form';

interface Page {
  data: ResourceRecord[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface ResourceManagerProps {
  /** Racine REST, ex. `/api/faculties`. */
  endpoint: string;
  title: string;
  description?: string;
  columns: readonly ColumnDef[];
  fields: readonly FieldDef[];
  /** `false` masque les actions d'écriture — le serveur les refuse de toute façon. */
  canWrite: boolean;
  searchPlaceholder?: string;
  /** Étiquette d'une ligne dans la confirmation de suppression. */
  rowLabel?: (row: ResourceRecord) => string;
  perPage?: number;
}

/**
 * Écran CRUD générique : liste cherchable et paginée, création, modification,
 * suppression confirmée. Les référentiels et le catalogue n'ont besoin que de
 * leur configuration.
 */
export function ResourceManager({
  endpoint,
  title,
  description,
  columns,
  fields,
  canWrite,
  searchPlaceholder,
  rowLabel = (row) => String(row['name'] ?? row['frName'] ?? row['id']),
  perPage = 25,
}: ResourceManagerProps) {
  const t = useTranslations();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('common.searchDefault');
  const [page, setPage] = React.useState<Page | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [query, setQuery] = React.useState('');
  const [deferredQuery, setDeferredQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<ResourceRecord | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredQuery(query.trim());
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const search = new URLSearchParams({ page: String(pageNumber), perPage: String(perPage) });
      if (deferredQuery) search.set('q', deferredQuery);
      setPage(await apiGet<Page>(`${endpoint}?${search.toString()}`));
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : t('common.loadingImpossible'));
    } finally {
      setLoading(false);
    }
  }, [deferredQuery, endpoint, pageNumber, perPage, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(row: ResourceRecord) {
    setEditing(row);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function submit(payload: Record<string, unknown>) {
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing) await apiPatch(`${endpoint}/${String(editing['id'])}`, payload);
      else await apiPost(endpoint, payload);

      setFormOpen(false);
      await load();
    } catch (error) {
      setFieldErrors(toFieldErrors(error));
      setFormError(error instanceof ApiError ? error.message : t('common.saveImpossible'));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(row: ResourceRecord) {
    // Une suppression n'est jamais silencieuse : elle se confirme.
    if (!window.confirm(t('common.removeConfirm', { label: rowLabel(row) }))) return;

    try {
      await apiDelete(`${endpoint}/${String(row['id'])}`);
      await load();
    } catch (error) {
      setListError(error instanceof ApiError ? error.message : t('common.deletionImpossible'));
    }
  }

  const rows = page?.data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>

        {canWrite ? (
          <Button onClick={openCreate}>
            <Plus />
            {t('common.newButton')}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('common.readOnly')}</p>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={resolvedSearchPlaceholder}
          aria-label={resolvedSearchPlaceholder}
          className="ps-9"
        />
      </div>

      {listError ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {listError}
        </p>
      ) : null}

      {loading && !page ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loadingShort')}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {deferredQuery ? t('common.noResults') : t('common.noItems')}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.align === 'end' ? 'text-end' : ''}>
                  {column.header}
                </TableHead>
              ))}
              {canWrite ? <TableHead className="text-end">{t('common.actions')}</TableHead> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={String(row['id'])}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={`py-2 ${column.align === 'end' ? 'text-end' : ''}`}
                  >
                    {column.render ? column.render(row) : displayValue(readPath(row, column.key))}
                  </TableCell>
                ))}

                {canWrite ? (
                  <TableCell className="py-2 text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(row)}
                        aria-label={t('table.modifyAria', { label: rowLabel(row) })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(row)}
                        aria-label={t('table.deleteAria', { label: rowLabel(row) })}
                        className="text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {page && page.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {t('pagination.info', {
              total: page.meta.total,
              page: page.meta.page,
              totalPages: page.meta.totalPages,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page.meta.page <= 1}
              onClick={() => setPageNumber((current) => current - 1)}
            >
              {t('common.previous')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page.meta.page >= page.meta.totalPages}
              onClick={() => setPageNumber((current) => current + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      ) : null}

      <ResourceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={
          editing
            ? t('common.modifyLabel', { label: rowLabel(editing) })
            : t('common.newLabel', { title })
        }
        fields={fields}
        record={editing}
        submitting={submitting}
        error={formError}
        fieldErrors={fieldErrors}
        onSubmit={submit}
      />
    </section>
  );
}
