'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { loginSchema } from '@/lib/validation/schemas';

export interface LoginState {
  error?: string;
  /** Champs fautifs, pour un affichage au bon endroit du formulaire. */
  fieldErrors?: Partial<Record<'email' | 'password', string>>;
}

/**
 * Connexion par identifiants.
 *
 * Le message d'échec est volontairement identique pour un e-mail inconnu, un
 * mot de passe faux et un compte désactivé : distinguer ces cas révélerait
 * quels comptes existent.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'email' || field === 'password') fieldErrors[field] = issue.message;
    }
    return { fieldErrors };
  }

  const from = formData.get('from');
  const redirectTo = typeof from === 'string' && from.startsWith('/') ? from : '/';

  try {
    await signIn('credentials', { ...parsed.data, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Identifiants incorrects, ou compte désactivé.' };
    }
    // `signIn` signale la redirection réussie par une exception : la relayer.
    throw error;
  }

  return {};
}
