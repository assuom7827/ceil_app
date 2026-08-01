import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActor } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t('login.metaTitle') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Déjà connecté : la page de connexion n'a plus de raison d'être.
  if (await getActor()) redirect('/');

  const { from } = await searchParams;
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t('app.university')}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{t('app.fullName')}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('login.title')}</CardTitle>
            <CardDescription>{t('login.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm from={from} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
