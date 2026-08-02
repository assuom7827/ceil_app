'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeliberationTab } from './deliberation-tab';
import { DocumentsTab } from './documents-tab';
import { EnrollmentsTab } from './enrollments-tab';
import { ExportTab } from './export-tab';
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
  const t = useTranslations();
  const [session, setSession] = React.useState(initialSession);
  const [enrollmentCount, setEnrollmentCount] = React.useState(0);
  const [groupCount, setGroupCount] = React.useState(0);
  const [admission, setAdmission] = React.useState<AdmissionSummary | null>(null);

  const locked = session.state === 'LOCKED';

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
          <TabsTrigger value="enrollments">{t('workspace.tabEnrollments')}</TabsTrigger>
          <TabsTrigger value="positioning">{t('workspace.tabPositioning')}</TabsTrigger>
          <TabsTrigger value="groups">{t('workspace.tabGroups')}</TabsTrigger>
          <TabsTrigger value="deliberation">{t('workspace.tabDeliberation')}</TabsTrigger>
          <TabsTrigger value="documents">{t('workspace.tabDocuments')}</TabsTrigger>
          <TabsTrigger value="export">{t('workspace.tabExport')}</TabsTrigger>
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
          <PositioningTab sessionId={session.id} canWrite={permissions.scores} locked={locked} />
        </TabsContent>

        <TabsContent value="groups">
          <GroupsTab
            sessionId={session.id}
            canWrite={permissions.groups}
            locked={locked}
            onCountChange={setGroupCount}
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

        <TabsContent value="documents">
          <DocumentsTab sessionId={session.id} />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab sessionId={session.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
