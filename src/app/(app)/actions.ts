'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { LOCALE_COOKIE, isLocale } from '@/i18n/config';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getActor } from '@/lib/auth/session';

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}

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

export async function changePassword(formData: FormData): Promise<{ error?: string; success?: string }> {
  const actor = await getActor();
  if (!actor) return { error: 'Unauthorized' };

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'All fields are required' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  if (newPassword.length < 10) {
    return { error: 'Password must be at least 10 characters' };
  }

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) return { error: 'User not found' };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: 'Current password is incorrect' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash } });

  return { success: 'Password changed successfully' };
}
