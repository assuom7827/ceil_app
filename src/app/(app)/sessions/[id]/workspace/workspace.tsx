'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api/client';
import { DeliberationTab } from './deliberation-tab';
import { EnrollmentsTab } from './enrollments-tab';
import { GroupsTab } from './groups-tab';
import { PositioningTab } from './positioning-tab';
import { SessionHeader } from './session-header';
import type { AdmissionSummary, WorkspacePermissions, WorkspaceSession } from './types';

/**
 * Espace de travail d'une session — écran principal d'utilisation quotidienne.
 *
 * Tout se fait ici, en onglets, sans quitter la page : inscrire, positionner,
 * noter, organiser les groupes. L'en-tête reste visible en permanence pour que
 * l'état de verrouillage et les compteurs soient toujours sous les yeux.
 */
export function Workspace({
  session: initialSession,
  permissions,
}: {
  session: WorkspaceSession;
  permissions: WorkspacePermissions;
}) {
  const [session, setSession] = React.useState(initialSession);
  const [enrollmentCount, setEnrollmentCount] = React.useState(0);
  const [groupCount, setGroupCount] = React.useState(0);
  const [admission, setAdmission] = React.useState<AdmissionSummary | null>(null);

  const locked = session.state === 'LOCKED';

  const refreshAdmission = React.useCallback(async () => {
    try {
      setAdmission(
        await apiGet<AdmissionSummary>(`/api/sessions/${session.id}/deliberation/recompute`),
      );
    } catch {
      // Compteur d'appoint : son échec ne doit pas empêcher de travailler.
    }
  }, [session.id]);

  return (
    <div className="space-y-6">
      <SessionHeader
        session={session}
        permissions={permissions}
        counters={{ enrollments: enrollmentCount, groups: groupCount, admission }}
        onSessionChanged={(patch) => setSession((previous) => ({ ...previous, ...patch }))}
      />

      <Tabs defaultValue="enrollments">
        <TabsList className="flex-wrap">
          <TabsTrigger value="enrollments">Inscrits</TabsTrigger>
          <TabsTrigger value="positioning">Positionnement</TabsTrigger>
          <TabsTrigger value="deliberation">Notes / Délibération</TabsTrigger>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments">
          <EnrollmentsTab
            sessionId={session.id}
            canWrite={permissions.enrollment}
            locked={locked}
            onCountChange={setEnrollmentCount}
          />
        </TabsContent>

        <TabsContent value="positioning">
          <PositioningTab
            sessionId={session.id}
            canWrite={permissions.scores}
            locked={locked}
          />
        </TabsContent>

        <TabsContent value="deliberation">
          <DeliberationTab
            sessionId={session.id}
            canWrite={permissions.scores}
            locked={locked}
            onAdmissionChange={setAdmission}
          />
        </TabsContent>

        <TabsContent value="groups">
          <GroupsTab
            sessionId={session.id}
            canWrite={permissions.groups}
            locked={locked}
            onCountChange={setGroupCount}
          />
        </TabsContent>

        <TabsContent value="documents">
          <div className="space-y-3 rounded-md border border-dashed p-6 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <FileText className="size-4" />
              Documents imprimables
            </p>
            <p className="text-muted-foreground">
              Diplômes des admis, attestations, procès-verbal de délibération et listes par groupe
              arrivent à l’étape 8, avec le rendu bilingue et le mois de fin de session en arabe.
            </p>
            <button
              type="button"
              onClick={refreshAdmission}
              className="text-primary underline underline-offset-4"
            >
              Rafraîchir le décompte des admis
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
