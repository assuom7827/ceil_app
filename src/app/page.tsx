import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Page d'accueil provisoire de l'étape 1 (scaffold).
 * Elle sera remplacée par le tableau de bord à l'étape 6.
 */
export default async function HomePage() {
  const t = await getTranslations();

  const roadmap = [
    { step: 1, label: 'Scaffold (Next.js, Prisma, Auth, i18n, tests)', done: true },
    { step: 2, label: 'Schéma Prisma normalisé + dérivés + seed', done: true },
    { step: 3, label: 'Couche services testée (règles de gestion)', done: false },
    { step: 4, label: 'API REST + RBAC + gestion d’erreurs', done: false },
    { step: 5, label: 'Authentification et rôles', done: false },
    { step: 6, label: 'Espace de travail Session (grilles éditables)', done: false },
    { step: 7, label: 'CRUD référentiels et catalogue', done: false },
    { step: 8, label: 'Documents imprimables bilingues', done: false },
    { step: 9, label: 'Tests e2e Playwright', done: false },
    { step: 10, label: 'Documentation et diagramme du modèle', done: false },
  ];

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10 space-y-2">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {t('app.university')}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{t('app.fullName')}</h1>
        <p className="text-muted-foreground">
          Application de gestion des inscriptions, du positionnement, des délibérations et des
          documents officiels.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Avancement de l’implémentation</CardTitle>
          <CardDescription>
            Étapes 1 et 2 terminées : structure du projet et modèle de données normalisé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {roadmap.map((item) => (
              <li key={item.step} className="flex items-center justify-between gap-4 text-sm">
                <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.step}. {item.label}
                </span>
                <Badge variant={item.done ? 'success' : 'outline'}>
                  {item.done ? 'Terminé' : 'À venir'}
                </Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
