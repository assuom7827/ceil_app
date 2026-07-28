import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Client accepté par les services : soit le client global, soit un client de
 * transaction. Les services reçoivent toujours leur `Db` en argument, ce qui
 * les rend composables (plusieurs services dans une même transaction) et
 * testables sans mock global.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Vrai lorsque le client est le client racine, capable d'ouvrir `$transaction`. */
export function isRootClient(db: Db): db is PrismaClient {
  return typeof (db as PrismaClient).$transaction === 'function';
}

/**
 * Exécute `fn` dans une transaction, ou directement si `db` est déjà un client
 * de transaction — une transaction imbriquée n'étant pas possible avec Prisma.
 */
export async function withTransaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (isRootClient(db)) {
    return db.$transaction(async (tx) => fn(tx));
  }
  return fn(db);
}
