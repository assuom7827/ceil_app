import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@prisma/client';

/**
 * Le rôle est porté par le JWT et la session : le RBAC serveur peut ainsi
 * s'appliquer sans requête base supplémentaire à chaque appel.
 *
 * `next-auth/jwt` se contente de ré-exporter `@auth/core/jwt` : c'est donc ce
 * dernier module qu'il faut augmenter pour que `token.role` soit typé.
 */
declare module 'next-auth' {
  interface Session {
    user: { id: string; role: UserRole } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role?: UserRole;
  }
}

export {};
