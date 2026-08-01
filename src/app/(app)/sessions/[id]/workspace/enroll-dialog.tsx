'use client';

import * as React from 'react';
import { Search, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost } from '@/lib/api/client';
import { deriveParticipantFullName } from '@/services/derive';
import { FeedbackBanner, Spinner, useAction } from './feedback';
import type { ParticipantSummary } from './types';

interface Draft {
  familyName: string;
  firstName: string;
  type: 'STUDENT' | 'TEACHER';
  phone: string;
}

const EMPTY_DRAFT: Draft = { familyName: '', firstName: '', type: 'STUDENT', phone: '' };

/**
 * Inscription simplifiée : UNE seule étape.
 *
 * Recherche multi-sélection de participants existants et création à la volée
 * cohabitent dans le même dialogue, et partent dans un seul appel — pas de
 * notion de lot, pas de formulaire multi-pages.
 */
export function EnrollDialog({
  sessionId,
  disabled,
  onEnrolled,
}: {
  sessionId: string;
  disabled: boolean;
  onEnrolled: () => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ParticipantSummary[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<Map<string, ParticipantSummary>>(new Map());
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const { pending, feedback, setFeedback, run } = useAction();

  // Recherche différée : on n'interroge pas le serveur à chaque frappe.
  React.useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const page = await apiGet<{ data: ParticipantSummary[] }>(
          `/api/participants?q=${encodeURIComponent(term)}&perPage=20`,
        );
        setResults(page.data);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, query]);

  function toggle(participant: ParticipantSummary, checked: boolean) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (checked) next.set(participant.id, participant);
      else next.delete(participant.id);
      return next;
    });
  }

  function reset() {
    setQuery('');
    setResults([]);
    setSelected(new Map());
    setDrafts([]);
    setFeedback(null);
  }

  const usableDrafts = drafts.filter(
    (draft) => draft.familyName.trim() !== '' || draft.firstName.trim() !== '',
  );
  const totalToEnroll = selected.size + usableDrafts.length;

  async function submit() {
    const ok = await run(async () => {
      const result = await apiPost<{
        created: number;
        skipped: number;
        participantsCreated: number;
      }>(`/api/sessions/${sessionId}/enroll`, {
        participantIds: [...selected.keys()],
        newParticipants: usableDrafts.map((draft) => ({
          familyName: draft.familyName.trim() || null,
          firstName: draft.firstName.trim() || null,
          type: draft.type,
          phone: draft.phone.trim() || null,
        })),
      });

      const parts = [`${result.created} inscription(s) créée(s)`];
      if (result.participantsCreated > 0) {
        parts.push(`${result.participantsCreated} participant(s) créé(s)`);
      }
      if (result.skipped > 0) parts.push(`${result.skipped} déjà inscrit(s), ignoré(s)`);
      return parts.join(' · ');
    });

    if (ok) {
      onEnrolled();
      reset();
      setOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <UserPlus />
          {t('enrollDialog.trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('enrollDialog.title')}</DialogTitle>
          <DialogDescription>{t('enrollDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="participant-search">{t('enrollDialog.searchLabel')}</Label>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="participant-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('enrollDialog.searchPlaceholder')}
              className="ps-9"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border">
            {searching ? (
              <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Spinner /> {t('enrollDialog.searching')}
              </p>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {query.trim().length < 2 ? t('enrollDialog.minChars') : t('enrollDialog.noResults')}
              </p>
            ) : (
              <ul>
                {results.map((participant) => (
                  <li key={participant.id} className="border-b last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 p-2 hover:bg-accent">
                      <Checkbox
                        checked={selected.has(participant.id)}
                        onCheckedChange={(checked) => toggle(participant, checked === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {deriveParticipantFullName(participant) || t('enrollDialog.noName')}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {participant.registrationNumber}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('enrollDialog.createOnFly')}</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDrafts((previous) => [...previous, { ...EMPTY_DRAFT }])}
            >
              {t('enrollDialog.addRow')}
            </Button>
          </div>

          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('enrollDialog.noneToCreate')}
            </p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((draft, index) => (
                <li key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Input
                    aria-label={t('enrollDialog.familyName')}
                    placeholder={t('enrollDialog.familyName')}
                    value={draft.familyName}
                    onChange={(event) =>
                      setDrafts((previous) =>
                        previous.map((item, position) =>
                          position === index ? { ...item, familyName: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={t('enrollDialog.firstName')}
                    placeholder={t('enrollDialog.firstName')}
                    value={draft.firstName}
                    onChange={(event) =>
                      setDrafts((previous) =>
                        previous.map((item, position) =>
                          position === index ? { ...item, firstName: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={t('enrollDialog.phone')}
                    placeholder={t('enrollDialog.phone')}
                    value={draft.phone}
                    onChange={(event) =>
                      setDrafts((previous) =>
                        previous.map((item, position) =>
                          position === index ? { ...item, phone: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <select
                    aria-label={t('enrollDialog.type')}
                    value={draft.type}
                    onChange={(event) =>
                      setDrafts((previous) =>
                        previous.map((item, position) =>
                          position === index
                            ? { ...item, type: event.target.value as Draft['type'] }
                            : item,
                        ),
                      )
                    }
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="STUDENT">{t('enrollDialog.student')}</option>
                    <option value="TEACHER">{t('enrollDialog.teacher')}</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setDrafts((previous) => previous.filter((_, position) => position !== index))
                    }
                  >
                    {t('enrollDialog.remove')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FeedbackBanner feedback={feedback} />

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t('enrollDialog.cancel')}
          </Button>
          <Button onClick={submit} disabled={pending || totalToEnroll === 0}>
            {pending ? <Spinner /> : null}
            {t('enrollDialog.submit')} {totalToEnroll > 0 ? `(${totalToEnroll})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
