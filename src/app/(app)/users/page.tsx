import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireActor } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { forbiddenError } from '@/services/errors';
import { canRead } from '@/services/rbac';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('users.title') };
}

/**
 * Administration des comptes — réservée à ADMIN.
 *
 * Le contrôle est refait ici, indépendamment du masquage de l'entrée de menu :
 * masquer un lien n'empêche personne de saisir l'URL.
 */
export default async function UsersPage() {
  const actor = await requireActor();
  const t = await getTranslations();
  if (!canRead(actor, 'User')) {
    throw forbiddenError(t('users.forbidden'), { role: actor.role });
  }

  const roleLabel = (role: string): string => {
    switch (role) {
      case 'ADMIN':
        return t('roles.ADMIN');
      case 'MANAGER':
        return t('roles.MANAGER');
      case 'USER':
        return t('roles.USER');
      default:
        return role;
    }
  };

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('users.title')}</h1>
        <p className="text-muted-foreground">{t('users.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('users.count', { count: users.length })}</CardTitle>
          <CardDescription>
            {t.rich('users.createdVia', {
              code: (chunks) => <code>{chunks}</code>,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-start font-medium">{t('users.colName')}</th>
                  <th className="py-2 text-start font-medium">{t('users.colEmail')}</th>
                  <th className="py-2 text-start font-medium">{t('users.colRole')}</th>
                  <th className="py-2 text-start font-medium">{t('users.colState')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{user.name}</td>
                    <td className="py-2 text-muted-foreground">{user.email}</td>
                    <td className="py-2">{roleLabel(user.role)}</td>
                    <td className="py-2">
                      <Badge variant={user.active ? 'success' : 'outline'}>
                        {user.active ? t('users.active') : t('users.inactive')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
