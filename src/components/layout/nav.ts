import type { Actor, Resource } from '@/services/rbac';
import { canRead } from '@/services/rbac';

export interface NavItem {
  href: string;
  /** Clé de traduction dans `messages/*.json`. */
  labelKey: string;
  /** Ressource conditionnant la visibilité de l'entrée. */
  resource: Resource;
  /**
   * `false` tant que l'écran n'existe pas : l'entrée s'affiche désactivée
   * plutôt que de mener à une 404. Passera à `true` aux étapes 6 et 7.
   */
  ready: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', labelKey: 'nav.dashboard', resource: 'TrainingSession', ready: true },
  { href: '/users', labelKey: 'nav.settings', resource: 'User', ready: true },
  { href: '/sessions', labelKey: 'nav.sessions', resource: 'TrainingSession', ready: false },
  { href: '/participants', labelKey: 'nav.participants', resource: 'Participant', ready: false },
  {
    href: '/positioning-tests',
    labelKey: 'nav.positioningTests',
    resource: 'PositioningTest',
    ready: false,
  },
  { href: '/trainings', labelKey: 'nav.trainings', resource: 'Training', ready: false },
  { href: '/payments', labelKey: 'nav.payments', resource: 'PaymentReceipt', ready: false },
  { href: '/references', labelKey: 'nav.references', resource: 'Faculty', ready: false },
];

/**
 * Entrées visibles par l'acteur.
 *
 * Ce filtrage est du confort d'affichage, pas une mesure de sécurité : chaque
 * page et chaque route API revérifient le droit côté serveur. Masquer un lien
 * n'a jamais empêché personne de saisir une URL.
 */
export function visibleNavItems(actor: Actor | null): NavItem[] {
  return NAV_ITEMS.filter((item) => canRead(actor, item.resource));
}
