/**
 * Configuration i18n partagée (client + serveur).
 * Le français est la langue par défaut ; l'arabe s'affiche en RTL.
 */
export const locales = ['fr', 'ar'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

/** Nom du cookie portant la langue choisie par l'utilisateur. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  fr: 'ltr',
  ar: 'rtl',
};

export const localeLabels: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
