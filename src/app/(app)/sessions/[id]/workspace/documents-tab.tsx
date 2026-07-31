'use client';

import * as React from 'react';
import { ExternalLink, FileDown, FileText, ScrollText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiGet } from '@/lib/api/client';
import { Spinner } from './feedback';
import type { AdmissionSummary, GroupRow } from './types';

interface DocumentLink {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** Raison pour laquelle le document n'est pas encore imprimable. */
  blocked?: string;
}

export function DocumentsTab({ sessionId }: { sessionId: string }) {
  const [groups, setGroups] = React.useState<GroupRow[] | null>(null);
  const [admission, setAdmission] = React.useState<AdmissionSummary | null>(null);
  const [groupId, setGroupId] = React.useState('');
  const [levelId, setLevelId] = React.useState('');

  React.useEffect(() => {
    void (async () => {
      const [sessionGroups, summary] = await Promise.all([
        apiGet<GroupRow[]>(`/api/sessions/${sessionId}/groups/organize-by-level`),
        apiGet<AdmissionSummary>(`/api/sessions/${sessionId}/deliberation/recompute`).catch(
          () => null,
        ),
      ]);
      setGroups(sessionGroups);
      setAdmission(summary);
    })();
  }, [sessionId]);

  const levelOptions = React.useMemo(() => {
    if (!groups) return [];
    const seen = new Map<string, string>();
    for (const group of groups) {
      if (group.trainingLevel && !seen.has(group.trainingLevel.id)) {
        seen.set(group.trainingLevel.id, group.trainingLevel.name);
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [groups]);

  if (!groups) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner /> Chargement…
      </p>
    );
  }

  const documents: DocumentLink[] = [
    {
      href: `/print/sessions/${sessionId}/attestations`,
      label: 'Attestations d’inscription',
      description: 'Une attestation par inscrit, admis ou non.',
      icon: <FileText className="size-4" />,
      blocked: admission && admission.total === 0 ? 'Aucun inscrit dans cette session.' : undefined,
    },
  ];

  const listHref = `/print/sessions/${sessionId}/list${groupId ? `?groupId=${groupId}` : ''}`;
  const certificatesHref = `/api/sessions/${sessionId}/certificates`;
  const noAdmitted = admission && admission.admitted === 0;

  const minutesHref = `/print/sessions/${sessionId}/minutes${levelId ? `?levelId=${levelId}` : ''}`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Les documents s’ouvrent dans un nouvel onglet, mis en page en A4, avec le mois de fin de
        session en arabe et les blocs bilingues en sens de lecture inversé.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-md border p-4">
          <p className="flex items-center gap-2 font-medium">
            <ScrollText className="size-4" />
            Procès-verbal de délibération
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tableau des notes des {admission?.total ?? 0} inscrit(s), paginé et signé.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="pv-level" className="text-xs text-muted-foreground">
                Niveau (optionnel)
              </Label>
              <select
                id="pv-level"
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
                className="h-9 w-48 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Tous les niveaux</option>
                {levelOptions.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>

            <Button asChild variant="outline" size="sm">
              <a href={minutesHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Ouvrir
              </a>
            </Button>
          </div>
        </li>

        {documents.map((document) => (
          <li key={document.href} className="rounded-md border p-4">
            <p className="flex items-center gap-2 font-medium">
              {document.icon}
              {document.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>

            {document.blocked ? (
              <p className="mt-3 text-sm text-muted-foreground">{document.blocked}</p>
            ) : (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href={document.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Ouvrir
                </a>
              </Button>
            )}
          </li>
        ))}

        <li className="rounded-md border p-4">
          <p className="flex items-center gap-2 font-medium">
            <FileDown className="size-4" />
            Attestations de réussite (PDF)
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {admission?.admitted ?? 0} attestation(s), une page par admis, depuis le gabarit
            LibreOffice du modèle de la session.
          </p>

          {noAdmitted ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun admis pour l’instant : saisissez les notes puis recalculez.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={certificatesHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Ouvrir en PDF
                </a>
              </Button>
              {/* L'ODT rempli permet une retouche avant impression — une faute de
                  frappe dans un nom se corrige alors sans repasser par la base. */}
              <Button asChild variant="ghost" size="sm">
                <a href={`${certificatesHref}?format=odt`}>
                  <FileDown />
                  Télécharger l’ODT rempli
                </a>
              </Button>
            </div>
          )}
        </li>

        <li className="rounded-md border p-4">
          <p className="flex items-center gap-2 font-medium">
            <Users className="size-4" />
            Liste des participants
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Liste d’émargement, avec colonne de signature.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="list-group" className="text-xs text-muted-foreground">
                Périmètre
              </Label>
              <select
                id="list-group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Toute la session</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.trainingLevel ? ` · ${group.trainingLevel.name}` : ''}
                    {group.groupType === 'EXAM' ? ' (examen)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <Button asChild variant="outline" size="sm">
              <a href={listHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Ouvrir
              </a>
            </Button>
          </div>
        </li>
      </ul>
    </div>
  );
}
