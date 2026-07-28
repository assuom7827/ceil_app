import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, defaultLocale, isLocale } from './config';

/**
 * La langue n'est pas portée par l'URL : elle est stockée dans un cookie,
 * ce qui évite de dupliquer toutes les routes sous un segment `[locale]`.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const candidate = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(candidate) ? candidate : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Africa/Algiers',
  };
});
