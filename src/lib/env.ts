import { z } from 'zod';

/**
 * Validation des variables d'environnement au démarrage : on échoue vite
 * plutôt que de découvrir une variable manquante au premier appel Prisma.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET doit contenir au moins 16 caractères'),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Variables d'environnement invalides :\n${details.join('\n')}\n` +
        'Copiez .env.example vers .env et renseignez les valeurs.',
    );
  }

  cached = parsed.data;
  return cached;
}
