/**
 * Client d'API côté navigateur.
 *
 * Il connaît la forme unique des erreurs produite par le wrapper serveur et la
 * transforme en exception typée : les composants affichent `error.message` sans
 * avoir à inspecter le statut, et les erreurs de validation restent
 * exploitables champ par champ.
 */
import type { ServiceErrorCode } from '@/services/errors';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ServiceErrorCode | 'INTERNAL';
  readonly details?: unknown;

  constructor(status: number, code: ApiError['code'], message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Erreurs par champ, quand le serveur a renvoyé un échec de validation. */
  get fieldIssues(): FieldIssue[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.filter(
      (issue): issue is FieldIssue =>
        typeof issue === 'object' &&
        issue !== null &&
        typeof (issue as FieldIssue).path === 'string' &&
        typeof (issue as FieldIssue).message === 'string',
    );
  }

  /** Vrai quand l'échec vient d'une session ou d'un test verrouillé. */
  get isLocked(): boolean {
    return this.code === 'LOCKED';
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const shape = (body ?? {}) as { error?: string; message?: string; details?: unknown };
  return new ApiError(
    response.status,
    (shape.error as ApiError['code']) ?? 'INTERNAL',
    shape.message ?? 'Une erreur est survenue.',
    shape.details,
  );
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { headers: { accept: 'application/json' } }));
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export const apiPost = <T>(url: string, body?: unknown) => send<T>('POST', url, body);
export const apiPut = <T>(url: string, body?: unknown) => send<T>('PUT', url, body);
export const apiPatch = <T>(url: string, body?: unknown) => send<T>('PATCH', url, body);
export const apiDelete = <T>(url: string) => send<T>('DELETE', url);

/** Envoi d'un fichier d'import (multipart, champ `file`). */
export async function apiUpload<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return parse<T>(await fetch(url, { method: 'POST', body: form }));
}
