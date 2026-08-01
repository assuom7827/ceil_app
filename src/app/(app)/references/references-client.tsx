'use client';

import { useTranslations } from 'next-intl';
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

function attestationTemplate(row: ResourceRecord): TemplateRow | null {
  const templates = row['templates'];
  if (!Array.isArray(templates)) return null;
  return (templates as TemplateRow[]).find((template) => template.kind === 'ATTESTATION') ?? null;
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
  const t = useTranslations();
  return (
    <Tabs defaultValue="faculties">
      <TabsList className="flex-wrap">
        <TabsTrigger value="faculties">{t('references.tabFaculties')}</TabsTrigger>
        <TabsTrigger value="specialities">{t('references.tabSpecialities')}</TabsTrigger>
        <TabsTrigger value="teachers">{t('references.tabTeachers')}</TabsTrigger>
        <TabsTrigger value="categories">{t('references.tabCategories')}</TabsTrigger>
        <TabsTrigger value="levels">{t('references.tabLevels')}</TabsTrigger>
          <TabsTrigger value="documents">{t('references.tabDocuments')}</TabsTrigger>
      </TabsList>

      <TabsContent value="faculties">
        <ResourceManager
          endpoint="/api/faculties"
          title={t('references.faculties')}
          description={t('references.facultiesDescription')}
          canWrite={permissions.faculty}
          columns={[
            { key: 'name', header: t('references.colName') },
            { key: 'description', header: t('references.colDescription') },
            { key: 'disabled', header: t('references.colDisabled') },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: t('references.fieldName'), required: true },
            { kind: 'textarea', name: 'description', label: t('references.fieldDescription') },
            { kind: 'checkbox', name: 'disabled', label: t('references.fieldDisabled') },
          ]}
        />
      </TabsContent>

      <TabsContent value="specialities">
        <ResourceManager
          endpoint="/api/specialities"
          title={t('references.specialities')}
          canWrite={permissions.speciality}
          columns={[
            { key: 'name', header: t('references.colName') },
            { key: 'arName', header: t('references.colArName') },
            { key: 'disabled', header: t('references.colDisabled') },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: t('references.fieldName'), required: true },
            { kind: 'text', name: 'arName', label: t('references.fieldArName') },
            { kind: 'textarea', name: 'description', label: t('references.fieldDescription') },
            { kind: 'checkbox', name: 'disabled', label: t('references.fieldDisabled') },
          ]}
        />
      </TabsContent>

      <TabsContent value="teachers">
        <ResourceManager
          endpoint="/api/teachers"
          title={t('references.teachers')}
          canWrite={permissions.teacher}
          searchPlaceholder={t('references.teachersSearch')}
          columns={[
            { key: 'name', header: t('references.colName') },
            { key: 'teacherType', header: t('references.colStatus') },
            { key: 'phone', header: t('references.colPhone') },
            { key: 'email', header: t('references.colEmail') },
            { key: 'disabled', header: t('references.colDisabled') },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: t('references.fieldName'), required: true },
            {
              kind: 'select',
              name: 'teacherType',
              label: t('references.fieldStatus'),
              required: true,
              options: [
                { value: 'PERMANENT', label: t('references.fieldPermanent') },
                { value: 'VACATAIRE', label: t('references.fieldVacataire') },
              ],
            },
            { kind: 'text', name: 'phone', label: t('references.fieldPhone') },
            { kind: 'text', name: 'email', label: t('references.fieldEmail') },
            { kind: 'textarea', name: 'description', label: t('references.fieldDescription') },
            { kind: 'checkbox', name: 'disabled', label: t('references.fieldDisabled') },
          ]}
        />
      </TabsContent>

      <TabsContent value="categories">
        <ResourceManager
          endpoint="/api/student-categories"
          title={t('references.categories')}
          canWrite={permissions.studentCategory}
          columns={[
            { key: 'name', header: t('references.colName') },
            { key: 'description', header: t('references.colDescription') },
            { key: 'disabled', header: t('references.colDisabled') },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: t('references.fieldName'), required: true },
            { kind: 'textarea', name: 'description', label: t('references.fieldDescription') },
            { kind: 'checkbox', name: 'disabled', label: t('references.fieldDisabled') },
          ]}
        />
      </TabsContent>

      <TabsContent value="levels">
        <ResourceManager
          endpoint="/api/training-levels"
          title={t('references.levels')}
          description={t('references.levelsDescription')}
          canWrite={permissions.trainingLevel}
          columns={[
            { key: 'sequence', header: t('references.colOrder'), align: 'end' },
            { key: 'name', header: t('references.colLevel') },
            {
              key: 'interval',
              header: t('references.colInterval'),
              render: (row) => `[${String(row['minimumPoints'])}, ${String(row['maximumPoints'])}[`,
            },
            { key: 'disabled', header: t('references.colDisabled') },
          ]}
          fields={[
            {
              kind: 'text',
              name: 'name',
              label: t('references.fieldName'),
              required: true,
              placeholder: t('references.levelNamePlaceholder'),
            },
            { kind: 'number', name: 'sequence', label: t('references.fieldOrder'), required: true },
            {
              kind: 'number',
              name: 'minimumPoints',
              label: t('references.fieldMinInclusive'),
              required: true,
            },
            {
              kind: 'number',
              name: 'maximumPoints',
              label: t('references.fieldMaxExclusive'),
              required: true,
              help: t('references.fieldMaxHelp'),
            },
            { kind: 'textarea', name: 'description', label: t('references.fieldDescription') },
            { kind: 'checkbox', name: 'disabled', label: t('references.fieldDisabled') },
          ]}
        />
      </TabsContent>

      <TabsContent value="documents">
        <ResourceManager
          endpoint="/api/diploma-models"
          title={t('references.diplomas')}
          description={t('references.diplomasDescription')}
          canWrite={permissions.diplomaModel}
          columns={[
            { key: 'name', header: t('references.colName') },
            { key: 'isDefault', header: t('references.colDefault') },
            { key: 'disabled', header: t('references.colDisabled') },
            {
              key: 'certificateTemplate',
              header: t('references.colCertificateTemplate'),
              render: (row) => {
                const template = certificateTemplate(row);
                return (
                  <TemplateControl
                    modelId={String(row['id'])}
                    kind="CERTIFICATE"
                    fileName={template?.fileName ?? null}
                    updatedAt={template?.updatedAt ?? null}
                    canWrite={permissions.diplomaModel}
                  />
                );
              },
            },
            {
              key: 'attestationTemplate',
              header: t('references.colAttestationTemplate'),
              render: (row) => {
                const template = attestationTemplate(row);
                return (
                  <TemplateControl
                    modelId={String(row['id'])}
                    kind="ATTESTATION"
                    fileName={template?.fileName ?? null}
                    updatedAt={template?.updatedAt ?? null}
                    canWrite={permissions.diplomaModel}
                  />
                );
              },
            },
          ]}
          fields={[
            { kind: 'text', name: 'name', label: t('references.fieldName'), required: true },
            { kind: 'checkbox', name: 'isDefault', label: t('references.fieldIsDefault') },
            {
              kind: 'text',
              name: 'universityLogo',
              label: t('references.fieldUniversityLogo'),
            },
            {
              kind: 'text',
              name: 'associationLogo',
              label: t('references.fieldAssociationLogo'),
            },
            {
              kind: 'text',
              name: 'backgroundImage',
              label: t('references.fieldBackgroundImage'),
            },
            { kind: 'textarea', name: 'heading', label: t('references.fieldHeading') },
            {
              kind: 'checkbox',
              name: 'disabled',
              label: t('references.fieldDisabled'),
              help: t('references.fieldDisabledDefaultHelp'),
            },
          ]}
          rowLabel={asName}
        />
      </TabsContent>
    </Tabs>
  );
}
