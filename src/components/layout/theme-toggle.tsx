'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const t = useTranslations();
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved ?? (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  if (!mounted) {
    return (
      <DropdownMenuItem disabled>
        <Sun className="mr-2 size-4" />
        {t('userMenu.theme')}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem onSelect={toggle}>
      {theme === 'dark' ? (
        <>
          <Sun className="mr-2 size-4" />
          {t('userMenu.lightMode')}
        </>
      ) : (
        <>
          <Moon className="mr-2 size-4" />
          {t('userMenu.darkMode')}
        </>
      )}
    </DropdownMenuItem>
  );
}
