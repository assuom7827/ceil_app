import type { ReactNode } from 'react';

/**
 * Description déclarative d'un formulaire de ressource.
 *
 * Les référentiels ne diffèrent que par leurs champs : les décrire ici évite
 * d'écrire treize formulaires qui divergeraient au premier ajustement.
 */
export type FieldDef =
  | {
      kind: 'text' | 'textarea' | 'number' | 'date' | 'time';
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      help?: string;
    }
  | { kind: 'checkbox'; name: string; label: string; help?: string }
  | {
      kind: 'select';
      name: string;
      label: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      required?: boolean;
      help?: string;
    }
  | {
      /** Lien vers une autre ressource (autocomplétion sur sa liste). */
      kind: 'reference';
      name: string;
      label: string;
      endpoint: string;
      optionLabel: (item: Record<string, unknown>) => string;
      required?: boolean;
      help?: string;
    }
  | {
      /** Relation M2N : la sélection remplace INTÉGRALEMENT l'existant. */
      kind: 'multiReference';
      name: string;
      label: string;
      endpoint: string;
      optionLabel: (item: Record<string, unknown>) => string;
      help?: string;
    }
  | {
      kind: 'logo';
      name: string;
      label: string;
      type: 'university' | 'association';
    };

export interface ColumnDef {
  key: string;
  header: string;
  render?: (row: Record<string, unknown>) => ReactNode;
  align?: 'start' | 'end';
}

export type ResourceRecord = Record<string, unknown>;

/** Lit une valeur imbriquée, ex. `training.frName`. */
export function readPath(row: ResourceRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}

/** Valeur affichable d'une cellule, sans jamais rendre `[object Object]`. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  // TODO i18n: 'Oui'/'Non' hors contexte React (fonction pure), à traduire ultérieurement.
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  // TODO i18n: format de date 'fr-FR' figé, à localiser ultérieurement.
  if (value instanceof Date) return value.toLocaleDateString('fr-FR');
  if (typeof value === 'string') {
    // Les dates arrivent en ISO depuis l'API.
    const isoDate = /^\d{4}-\d{2}-\d{2}T/.exec(value);
    // TODO i18n: format de date 'fr-FR' figé, à localiser ultérieurement.
    if (isoDate) return new Date(value).toLocaleDateString('fr-FR');
    return value;
  }
  if (typeof value === 'number') return String(value);
  return '—';
}
