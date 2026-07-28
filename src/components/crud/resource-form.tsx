'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, ApiError } from '@/lib/api/client';
import { readPath, type FieldDef, type ResourceRecord } from './fields';

type FormValue = string | boolean | string[];

function initialValue(field: FieldDef, record: ResourceRecord | null): FormValue {
  if (field.kind === 'checkbox') {
    return record ? Boolean(readPath(record, field.name)) : false;
  }
  if (field.kind === 'multiReference') {
    const related = record?.[field.name.replace(/Ids$/, 's')];
    if (Array.isArray(related)) {
      return related.map((item) => String((item as ResourceRecord)['id']));
    }
    return [];
  }
  if (!record) return '';

  const raw = readPath(record, field.name);
  if (raw === null || raw === undefined) return '';
  if (field.kind === 'date' && typeof raw === 'string') return raw.slice(0, 10);
  return String(raw);
}

/**
 * Formulaire de création / modification.
 *
 * La validation reste celle du serveur : les erreurs `{ path, message }`
 * renvoyées par l'API sont replacées sous leur champ, sans dupliquer les règles
 * Zod côté client.
 */
export function ResourceForm({
  open,
  onOpenChange,
  title,
  description,
  fields,
  record,
  submitting,
  error,
  fieldErrors,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: readonly FieldDef[];
  record: ResourceRecord | null;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, FormValue>>({});
  const [options, setOptions] = React.useState<Record<string, ResourceRecord[]>>({});

  React.useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((field) => [field.name, initialValue(field, record)])));
  }, [fields, open, record]);

  // Les listes de référence sont chargées une fois à l'ouverture.
  React.useEffect(() => {
    if (!open) return;

    const referenceFields = fields.filter(
      (field) => field.kind === 'reference' || field.kind === 'multiReference',
    );

    void Promise.all(
      referenceFields.map(async (field) => {
        if (field.kind !== 'reference' && field.kind !== 'multiReference') return null;
        try {
          const page = await apiGet<{ data: ResourceRecord[] }>(`${field.endpoint}?perPage=200`);
          return [field.name, page.data] as const;
        } catch {
          return [field.name, []] as const;
        }
      }),
    ).then((entries) => {
      setOptions(Object.fromEntries(entries.filter((entry) => entry !== null)));
    });
  }, [fields, open]);

  function update(name: string, value: FormValue) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.name];

      if (field.kind === 'checkbox') {
        payload[field.name] = Boolean(value);
      } else if (field.kind === 'multiReference') {
        payload[field.name] = Array.isArray(value) ? value : [];
      } else if (field.kind === 'number') {
        const text = String(value ?? '').trim();
        // Un champ numérique vide vaut « non renseigné », pas zéro.
        payload[field.name] = text === '' ? null : Number(text.replace(',', '.'));
      } else {
        const text = String(value ?? '').trim();
        payload[field.name] = text === '' ? null : text;
      }
    }

    onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {fields.map((field) => {
            const id = `field-${field.name}`;
            const message = fieldErrors[field.name];
            const value = values[field.name];

            return (
              <div key={field.name} className="space-y-1.5">
                {field.kind === 'checkbox' ? (
                  <label className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={Boolean(value)}
                      onCheckedChange={(checked) => update(field.name, checked === true)}
                    />
                    <span className="text-sm font-medium">{field.label}</span>
                  </label>
                ) : (
                  <>
                    <Label htmlFor={id}>
                      {field.label}
                      {'required' in field && field.required ? (
                        <span className="text-destructive"> *</span>
                      ) : null}
                    </Label>

                    {field.kind === 'textarea' ? (
                      <textarea
                        id={id}
                        value={String(value ?? '')}
                        onChange={(event) => update(field.name, event.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    ) : field.kind === 'select' ? (
                      <select
                        id={id}
                        value={String(value ?? '')}
                        onChange={(event) => update(field.name, event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">—</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.kind === 'reference' ? (
                      <select
                        id={id}
                        value={String(value ?? '')}
                        onChange={(event) => update(field.name, event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">—</option>
                        {(options[field.name] ?? []).map((item) => (
                          <option key={String(item['id'])} value={String(item['id'])}>
                            {field.optionLabel(item)}
                          </option>
                        ))}
                      </select>
                    ) : field.kind === 'multiReference' ? (
                      <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                        {(options[field.name] ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucun élément disponible.</p>
                        ) : (
                          (options[field.name] ?? []).map((item) => {
                            const itemId = String(item['id']);
                            const selected = Array.isArray(value) && value.includes(itemId);
                            return (
                              <label key={itemId} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={(checked) => {
                                    const current = Array.isArray(value) ? value : [];
                                    update(
                                      field.name,
                                      checked === true
                                        ? [...current, itemId]
                                        : current.filter((entry) => entry !== itemId),
                                    );
                                  }}
                                />
                                {field.optionLabel(item)}
                              </label>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <Input
                        id={id}
                        type={field.kind === 'date' ? 'date' : 'text'}
                        inputMode={field.kind === 'number' ? 'decimal' : undefined}
                        placeholder={'placeholder' in field ? field.placeholder : undefined}
                        value={String(value ?? '')}
                        onChange={(event) => update(field.name, event.target.value)}
                        aria-invalid={Boolean(message)}
                      />
                    )}
                  </>
                )}

                {'help' in field && field.help ? (
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                ) : null}
                {message ? <p className="text-sm text-destructive">{message}</p> : null}
              </div>
            );
          })}

          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Extrait les erreurs par champ d'une réponse d'API. */
export function toFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.fieldIssues.map((issue) => [issue.path, issue.message]));
}
