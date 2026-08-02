'use client';

import { Download, Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const EXPORT_FORMATS = [
  { value: 'xlsx', labelKey: 'exportTab.xlsxFmt', icon: <Table2 className="size-4" /> },
  { value: 'csv', labelKey: 'exportTab.csvFmt', icon: <Download className="size-4" /> },
] as const;

interface ExportSpec {
  key: string;
  labelKey: string;
  descriptionKey: string;
}

/**
 * Onglet d'export des données brutes.
 *
 * Contrairement à l'onglet Documents qui produit des documents officiels
 * mis en page (PDF, attestations), cet onglet exporte les DONNÉES TABULAIRES
 * au format CSV ou Excel — prêtes pour un tableur, un archivage ou une
 * intégration externe. Chaque export est généré côté serveur : le navigateur
 * ne reçoit qu'un lien de téléchargement, jamais les données agrégées.
 */
export function ExportTab({ sessionId }: { sessionId: string }) {
  const t = useTranslations();

  const specs: ExportSpec[] = [
    {
      key: 'enrollments',
      labelKey: 'exportTab.enrollments',
      descriptionKey: 'exportTab.enrollmentsDesc',
    },
    { key: 'scores', labelKey: 'exportTab.scores', descriptionKey: 'exportTab.scoresDesc' },
  ];

  const exportUrl = (what: string, format: string) =>
    `/api/sessions/${sessionId}/export?what=${what}&format=${format}`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('exportTab.intro')}</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {specs.map((spec) => (
          <li key={spec.key} className="rounded-md border p-4">
            <p className="flex items-center gap-2 font-medium">
              <Table2 className="size-4" />
              {t(spec.labelKey)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t(spec.descriptionKey)}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {EXPORT_FORMATS.map((format) => (
                <Button key={format.value} asChild variant="outline" size="sm">
                  <a href={exportUrl(spec.key, format.value)} download>
                    {format.icon}
                    {t(format.labelKey)}
                  </a>
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
