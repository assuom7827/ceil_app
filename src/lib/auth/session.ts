import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PATHNAME_HEADER } from '@/middleware';
import type { Actor } from '@/services/rbac';

/**
 * Acteur courant côté serveur (Server Components, server actions).
 * Retourne `null` plutôt que de lever : à l'appelant de décider.
 */
export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role };
}

/**
 * Garde des pages authentifiées : redirige vers la connexion en conservant la
 * destination, pour y revenir une fois connecté.
 *
 * Le chemin demandé provient de l'en-tête posé par le middleware — un layout
 * n'a pas accès à l'URL courante autrement.
 */
export async function requireActor(returnTo?: string): Promise<Actor> {
  const actor = await getActor();
  if (actor) return actor;

  const target = returnTo ?? (await headers()).get(PATHNAME_HEADER);
  // Revenir sur l'accueil est le comportement par défaut : inutile de le
  // transporter dans l'URL.
  const shouldReturn = target && target !== '/' && target.startsWith('/');

  redirect(shouldReturn ? `/login?from=${encodeURIComponent(target)}` : '/login');
}

/** Profil affiché dans l'en-tête (nom, e-mail, rôle). */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? session.user.email ?? '',
    email: session.user.email ?? '',
    role: session.user.role,
  };
}
