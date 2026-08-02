/**
 * Thème par défaut de l'application, configurable via la variable
 * `NEXT_PUBLIC_DEFAULT_THEME` (dark | light).
 *
 * Le thème choisi par l'utilisateur (via le menu contextuel) est stocké dans
 * `localStorage` et a priorité sur cette valeur par défaut.
 *
 * Exemple :
 *   NEXT_PUBLIC_DEFAULT_THEME=dark   → l'interface est sombre par défaut
 *   NEXT_PUBLIC_DEFAULT_THEME=light  → l'interface est claire par défaut
 */
const VALID_THEMES = ['dark', 'light'] as const;
type Theme = (typeof VALID_THEMES)[number];

export const defaultTheme: Theme = VALID_THEMES.includes(
  (process.env.NEXT_PUBLIC_DEFAULT_THEME ?? 'dark') as Theme,
)
  ? (process.env.NEXT_PUBLIC_DEFAULT_THEME as Theme)
  : 'dark';
