import { requireActor } from '@/lib/auth/session';

/**
 * Shell des pages imprimables : ni navigation ni en-tête applicatif, pour que
 * la page corresponde au papier. La garde d'accès reste la même que le reste
 * de l'application — un document officiel ne s'ouvre pas sans être connecté.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireActor();
  return <div className="min-h-screen bg-muted/40 pb-10">{children}</div>;
}
