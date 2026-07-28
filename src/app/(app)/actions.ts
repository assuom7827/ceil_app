'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { LOCALE_COOKIE, isLocale } from '@/i18n/config';

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}

/**
 * Change la langue de l'interface.
 * La locale vit dans un cookie plutôt que dans l'URL : aucune route n'est
 * dupliquée sous un segment `[locale]`, et l'utilisateur reste sur sa page.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get('locale');
  if (!isLocale(value)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}
