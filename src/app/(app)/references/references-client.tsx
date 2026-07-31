'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResourceManager } from '@/components/crud/resource-manager';
import type { ResourceRecord } from '@/components/crud/fields';
import { TemplateControl } from '@/components/documents/template-control';

/** Gabarit d'attestation d'un modèle, tel que la liste le renvoie. */
interface TemplateRow {
  kind: string;
  fileName: string;
  updatedAt: string;
}

function certificateTemplate(row: ResourceRecord): TemplateRow | null {
  const templates = row['templates'];
  if (!Array.isArray(templates)) return null;
  return (templates as TemplateRow[]).find((template) => template.kind === 'CERTIFICATE') ?? null;
}

export interface ReferencePermissions {
  faculty: boolean;
  speciality: boolean;
  teacher: boolean;
  studentCategory: boolean;
  trainingLevel: boolean;
  diplomaModel: boolean;
}

const asName = (item: ResourceRecord) => String(item['name'] ?? '');

export function ReferencesClient({ permissions }: { permissions: ReferencePermissions }) {
  return (
    <Tabs defaultValue="faculties">
      <TabsList className="flex-wrap">
        <TabsTrigger value="faculties">Facultés</TabsTrigger>
        <TabsTrigger value="specialities">Spécialités</TabsTrigger>
        <TabsTrigger value="teachers">Enseignants</TabsTrigger>
        <TabsTrigger value="categories">Catégories</TabsTrigger>
        <TabsTrigger value="levels">Niveaux CECRL</TabsTrigger>
        <TabsTrigger value="diplomas">Modèles de diplôme</TabsTrigger>
      </TabsList>

      <TabsContent value="faculties">
        <ResourceManager
          endpoint="/api/faculties"
          title="Facultés"
          description="Rattachement universitaire des participants."
          canWrite={permissions.faculty}
          columns={[
            { key: 'name', header: 'Nom' },
            { key: 'description', header: 'Description' },
            { key: 'disabled', header: 'Désactivée' },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: 'Nom', required: true },
            { kind: 'textarea', name: 'description', label: 'Description' },
            { kind: 'checkbox', name: 'disabled', label: 'Désactivée' },
          ]}
        />
      </TabsContent>

      <TabsContent value="specialities">
        <ResourceManager
          endpoint="/api/specialities"
          title="Spécialités"
          canWrite={permissions.speciality}
          columns={[
            { key: 'name', header: 'Nom' },
            { key: 'arName', header: 'Nom arabe' },
            { key: 'disabled', header: 'Désactivée' },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: 'Nom', required: true },
            { kind: 'text', name: 'arName', label: 'Nom arabe' },
            { kind: 'textarea', name: 'description', label: 'Description' },
            { kind: 'checkbox', name: 'disabled', label: 'Désactivée' },
          ]}
        />
      </TabsContent>

      <TabsContent value="teachers">
        <ResourceManager
          endpoint="/api/teachers"
          title="Enseignants"
          canWrite={permissions.teacher}
          searchPlaceholder="Nom, e-mail ou téléphone…"
          columns={[
            { key: 'name', header: 'Nom' },
            { key: 'teacherType', header: 'Statut' },
            { key: 'phone', header: 'Téléphone' },
            { key: 'email', header: 'E-mail' },
            { key: 'disabled', header: 'Désactivé' },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: 'Nom', required: true },
            {
              kind: 'select',
              name: 'teacherType',
              label: 'Statut',
              required: true,
              options: [
                { value: 'PERMANENT', label: 'Permanent' },
                { value: 'VACATAIRE', label: 'Vacataire' },
              ],
            },
            { kind: 'text', name: 'phone', label: 'Téléphone' },
            { kind: 'text', name: 'email', label: 'E-mail' },
            { kind: 'textarea', name: 'description', label: 'Description' },
            { kind: 'checkbox', name: 'disabled', label: 'Désactivé' },
          ]}
        />
      </TabsContent>

      <TabsContent value="categories">
        <ResourceManager
          endpoint="/api/student-categories"
          title="Catégories de participant"
          canWrite={permissions.studentCategory}
          columns={[
            { key: 'name', header: 'Nom' },
            { key: 'description', header: 'Description' },
            { key: 'disabled', header: 'Désactivée' },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: 'Nom', required: true },
            { kind: 'textarea', name: 'description', label: 'Description' },
            { kind: 'checkbox', name: 'disabled', label: 'Désactivée' },
          ]}
        />
      </TabsContent>

      <TabsContent value="levels">
        <ResourceManager
          endpoint="/api/training-levels"
          title="Niveaux CECRL"
          description="Intervalle SEMI-OUVERT [minimum, maximum[ : un total égal au maximum bascule au niveau suivant."
          canWrite={permissions.trainingLevel}
          columns={[
            { key: 'sequence', header: 'Ordre', align: 'end' },
            { key: 'name', header: 'Niveau' },
            {
              key: 'interval',
              header: 'Intervalle',
              render: (row) => `[${String(row['minimumPoints'])}, ${String(row['maximumPoints'])}[`,
            },
            { key: 'disabled', header: 'Désactivé' },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: 'Nom', required: true, placeholder: 'B1.1' },
            { kind: 'number', name: 'sequence', label: 'Ordre', required: true },
            { kind: 'number', name: 'minimumPoints', label: 'Minimum (inclus)', required: true },
            {
              kind: 'number',
              name: 'maximumPoints',
              label: 'Maximum (exclu)',
              required: true,
              help: 'Doit être strictement supérieur au minimum.',
            },
            { kind: 'textarea', name: 'description', label: 'Description' },
            { kind: 'checkbox', name: 'disabled', label: 'Désactivé' },
          ]}
        />
      </TabsContent>

      <TabsContent value="diplomas">
        <ResourceManager
          endpoint="/api/diploma-models"
          title="Modèles de diplôme"
          description="Un seul modèle par défaut actif : en désigner un nouveau retire le précédent. Le gabarit ODT, préparé dans LibreOffice, porte la mise en page des attestations."
          canWrite={permissions.diplomaModel}
          columns={[
            { key: 'name', header: 'Nom' },
            { key: 'isDefault', header: 'Par défaut' },
            { key: 'disabled', header: 'Désactivé' },
            {
              key: 'templates',
              header: 'Gabarit d’attestation (ODT)',
              render: (row) => {
                const template = certificateTemplate(row);
                return (
                  <TemplateControl
                    modelId={String(row['id'])}
                    fileName={template?.fileName ?? null}
                    updatedAt={template?.updatedAt ?? null}
                    canWrite={permissions.diplomaModel}
                  />
                );
              },
            },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: 'Nom', required: true },
            { kind: 'checkbox', name: 'isDefault', label: 'Modèle par défaut' },
            { kind: 'text', name: 'universityLogo', label: 'Logo université (URL)' },
            { kind: 'text', name: 'associationLogo', label: 'Logo association (URL)' },
            { kind: 'text', name: 'backgroundImage', label: 'Image de fond (URL)' },
            { kind: 'textarea', name: 'heading', label: 'En-tête (HTML bilingue)' },
            {
              kind: 'checkbox',
              name: 'disabled',
              label: 'Désactivé',
              help: 'Un modèle désactivé ne peut pas rester le modèle par défaut.',
            },
          ]}
          rowLabel={asName}
        />
      </TabsContent>
    </Tabs>
  );
}
