import { describe, expect, it } from 'vitest';
import { defaultLocale, isLocale, localeDirection, locales } from '@/i18n/config';
import { cn } from '@/lib/utils';

describe('scaffold', () => {
  it('expose les deux langues avec le français par défaut', () => {
    expect(locales).toEqual(['fr', 'ar']);
    expect(defaultLocale).toBe('fr');
  });

  it("marque l'arabe comme langue RTL", () => {
    expect(localeDirection.ar).toBe('rtl');
    expect(localeDirection.fr).toBe('ltr');
  });

  it('rejette une langue inconnue', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('fusionne les classes Tailwind en conservant la dernière', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});
