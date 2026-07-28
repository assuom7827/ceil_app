import { PrismaClient } from '@prisma/client';

/**
 * Instance unique de PrismaClient : en développement, le hot-reload de Next
 * recrée les modules et ouvrirait un pool de connexions à chaque rechargement.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
