/**
 * Configuration globale des tests unitaires.
 * Les services testés à l'étape 3 sont des fonctions pures : aucun accès base
 * n'est requis ici, seules les variables d'environnement sont neutralisées.
 */
process.env.TZ = 'Africa/Algiers';
// Base dédiée aux tests : jamais la base de développement.
process.env.DATABASE_URL ??= 'postgresql://ceil:ceil@127.0.0.1:5432/ceil_test?schema=public';
process.env.AUTH_SECRET ??= 'secret-de-test-uniquement-non-utilise-en-prod';
