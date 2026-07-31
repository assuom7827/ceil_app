'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResourceForm, toFieldErrors } from '@/components/crud/resource-form';
import type { ResourceRecord } from '@/components/crud/fields';
import { ApiError, apiDelete, apiGet, apiPatch } from '@/lib/api/client';
import { sessionFormFields } from './session-fields';
import type { Role } from '@/services/rbac';

export function SessionActions({
  sessionId,
  role,
  canWrite,
  enrollmentCount,
}: {
  sessionId: string;
  role: Role | null;
  canWrite: boolean;
  enrollmentCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [record, setRecord] = React.useState<ResourceRecord | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  if (!canWrite) return null;

  const canDelete = role === 'ADMIN' || (role === 'MANAGER' && enrollmentCount === 0);

  async function openEdit() {
    setEditing(true);
    setEditError(null);
    setFieldErrors({});
    setRecord(null);
    try {
      const session = await apiGet<ResourceRecord>(`/api/sessions/${sessionId}`);
      const flattened: ResourceRecord = {
        code: session['code'],
        academicYear: session['academicYear'],
        dateFrom: session['dateFrom'],
        dateTo: session['dateTo'],
        admissionThreshold: session['admissionThreshold'],
        matriculePrefix: session['matriculePrefix'],
        trainingId: (session['training'] as ResourceRecord | undefined)?.['id'],
        trainingLevelId: (session['trainingLevel'] as ResourceRecord | undefined)?.['id'],
        diplomaModelId: (session['diplomaModel'] as ResourceRecord | undefined)?.['id'],
      };
      setRecord(flattened);
    } catch (caught) {
      setEditError(caught instanceof ApiError ? caught.message : 'Session introuvable.');
    }
  }

  async function submit(payload: Record<string, unknown>) {
    setSubmitting(true);
    setEditError(null);
    setFieldErrors({});
    try {
      await apiPatch(`/api/sessions/${sessionId}`, payload);
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setFieldErrors(toFieldErrors(caught));
      setEditError(caught instanceof ApiError ? caught.message : 'Modification impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm('Supprimer cette session ? Cette action est irréversible.')) return;
    try {
      await apiDelete(`/api/sessions/${sessionId}`);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : 'Suppression impossible : des inscriptions sont liées à cette session.';
      window.alert(message);
    }
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={openEdit} aria-label="Modifier">
          <Pencil />
        </Button>
        {canDelete ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={remove}
            aria-label="Supprimer"
            className="text-destructive"
          >
            <Trash2 />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled
            aria-label="Suppression bloquée — des inscrits sont liés"
            className="text-muted-foreground"
            title="Suppression bloquée : des inscrits sont liés à cette session."
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <ResourceForm
        open={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
        title="Modifier la session"
        record={record}
        submitting={submitting}
        error={editError}
        fieldErrors={fieldErrors}
        onSubmit={submit}
        fields={sessionFormFields}
      />
    </>
  );
}
