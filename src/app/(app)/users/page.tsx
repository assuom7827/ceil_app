import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireActor } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { forbiddenError } from '@/services/errors';
import { canRead } from '@/services/rbac';

export const metadata: Metadata = { title: 'Comptes' };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Responsable',
  USER: 'Agent de saisie',
};

/**
 * Administration des comptes — réservée à ADMIN.
 *
 * Le contrôle est refait ici, indépendamment du masquage de l'entrée de menu :
 * masquer un lien n'empêche personne de saisir l'URL.
 */
export default async function UsersPage() {
  const actor = await requireActor();
  if (!canRead(actor, 'User')) {
    throw forbiddenError('Cette page est réservée aux administrateurs.', { role: actor.role });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comptes</h1>
        <p className="text-muted-foreground">Utilisateurs autorisés à accéder à l’application.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{users.length} compte(s)</CardTitle>
          <CardDescription>
            La création et la modification passent par <code>/api/users</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-start font-medium">Nom</th>
                  <th className="py-2 text-start font-medium">E-mail</th>
                  <th className="py-2 text-start font-medium">Rôle</th>
                  <th className="py-2 text-start font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{user.name}</td>
                    <td className="py-2 text-muted-foreground">{user.email}</td>
                    <td className="py-2">{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td className="py-2">
                      <Badge variant={user.active ? 'success' : 'outline'}>
                        {user.active ? 'Actif' : 'Désactivé'}
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
