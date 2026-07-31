import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import { MainNav } from '@/components/layout/main-nav';
import { visibleNavItems } from '@/components/layout/nav';
import { UserMenu } from '@/components/layout/user-menu';
import type { Locale } from '@/i18n/config';
import { getSessionUser, requireActor } from '@/lib/auth/session';
import { logout, setLocale } from './actions';

/**
 * Shell des pages authentifiées.
 *
 * La garde vit ici plutôt que dans un middleware : le middleware s'exécute sur
 * le runtime edge, incompatible avec bcrypt et le client Prisma dont dépend le
 * provider credentials. Une vérification en Server Component est en outre au
 * plus près de la donnée — et l'API refait de toute façon le contrôle.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const [user, locale, t] = await Promise.all([getSessionUser(), getLocale(), getTranslations()]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/95 shadow-card backdrop-blur">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.svg"
              alt="CEIL"
              width={36}
              height={36}
              className="hidden h-9 w-9 shrink-0 sm:block"
            />
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-widest text-muted-foreground">
                {t('app.university')}
              </p>
              <p className="truncate text-lg font-semibold text-primary">{t('app.fullName')}</p>
            </div>
          </div>

          {user ? (
            <UserMenu
              user={user}
              locale={locale as Locale}
              logoutAction={logout}
              setLocaleAction={setLocale}
            />
          ) : null}
        </div>

        <div className="container pb-2">
          <MainNav items={visibleNavItems(actor)} />
        </div>
      </header>

      <div className="container flex-1 py-8">{children}</div>
    </div>
  );
}
