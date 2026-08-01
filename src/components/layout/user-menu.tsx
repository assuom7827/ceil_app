'use client';

import { ChevronDown, LogOut, Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { localeLabels, locales, type Locale } from '@/i18n/config';

export interface UserMenuProps {
  user: { name: string; email: string; role: string };
  locale: Locale;
  logoutAction: () => Promise<void>;
  setLocaleAction: (formData: FormData) => Promise<void>;
}

export function UserMenu({ user, locale, logoutAction, setLocaleAction }: UserMenuProps) {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <span className="max-w-[12rem] truncate">{user.name}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <div className="truncate font-semibold">{user.name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          <Languages className="size-3.5" />
          {t('userMenu.language')}
        </DropdownMenuLabel>
        {locales.map((value) => (
          <form key={value} action={setLocaleAction}>
            <input type="hidden" name="locale" value={value} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-start" aria-current={value === locale}>
                <span className={value === locale ? 'font-semibold' : undefined}>
                  {localeLabels[value]}
                </span>
              </button>
            </DropdownMenuItem>
          </form>
        ))}

        <DropdownMenuSeparator />

        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-start text-destructive">
              <LogOut className="size-4" />
              {t('userMenu.logout')}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
