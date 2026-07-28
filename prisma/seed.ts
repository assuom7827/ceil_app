/**
 * Seed reproductible.
 *
 * ÉTAPE 1 : crée uniquement les deux comptes de démonstration.
 * ÉTAPE 2 : y seront ajoutés les niveaux CECRL, le modèle de diplôme par
 * défaut, des formations d'exemple et des gabarits de groupes.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedUsers() {
  const accounts = [
    {
      email: process.env.SEED_MANAGER_EMAIL ?? 'manager@ceil.local',
      password: process.env.SEED_MANAGER_PASSWORD ?? 'Ceil@Manager2025!',
      name: 'Responsable CEIL',
      role: UserRole.MANAGER,
    },
    {
      email: process.env.SEED_USER_EMAIL ?? 'user@ceil.local',
      password: process.env.SEED_USER_PASSWORD ?? 'Ceil@User2025!',
      name: 'Agent de saisie',
      role: UserRole.USER,
    },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role, passwordHash, active: true },
      create: {
        email: account.email,
        name: account.name,
        role: account.role,
        passwordHash,
      },
    });
    console.log(`  ✓ ${account.role.padEnd(8)} ${account.email}`);
  }
}

async function main() {
  console.log('Seed CEIL — comptes de démonstration :');
  await seedUsers();
  console.log('Seed terminé.');
}

main()
  .catch((error) => {
    console.error('Échec du seed :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
