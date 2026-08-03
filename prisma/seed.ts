/**
 * Seed reproductible — idempotent (tout passe par des `upsert` sur clé unique,
 * on peut donc le relancer sans dupliquer ni casser les données existantes).
 *
 * Contenu : niveaux CECRL, modèle de diplôme par défaut, formations d'exemple
 * reliées aux niveaux, gabarits de groupes, référentiels (facultés, catégories,
 * spécialités, enseignants) et les deux comptes de démonstration.
 */
import { GroupType, PrismaClient, TeacherType, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Niveaux CECRL
//
// Barème sur 0..100 : le total du test de positionnement est la somme de deux
// notes écrites (E.E + C.E) supposées sur 50. Les intervalles sont contigus et
// SEMI-OUVERTS [min, max[ — 100 est inclus grâce au max 101 du dernier niveau.
// ---------------------------------------------------------------------------
const TRAINING_LEVELS = [
  { name: 'A0', sequence: 1, minimumPoints: 0, maximumPoints: 10, description: 'Débutant complet' },
  { name: 'A1.1', sequence: 2, minimumPoints: 10, maximumPoints: 20, description: 'Introductif 1' },
  { name: 'A1.2', sequence: 3, minimumPoints: 20, maximumPoints: 30, description: 'Introductif 2' },
  { name: 'A2.1', sequence: 4, minimumPoints: 30, maximumPoints: 40, description: 'Survie 1' },
  { name: 'A2.2', sequence: 5, minimumPoints: 40, maximumPoints: 50, description: 'Survie 2' },
  { name: 'B1.1', sequence: 6, minimumPoints: 50, maximumPoints: 60, description: 'Seuil 1' },
  { name: 'B1.2', sequence: 7, minimumPoints: 60, maximumPoints: 70, description: 'Seuil 2' },
  { name: 'B2.1', sequence: 8, minimumPoints: 70, maximumPoints: 80, description: 'Avancé 1' },
  { name: 'B2.2', sequence: 9, minimumPoints: 80, maximumPoints: 90, description: 'Avancé 2' },
  { name: 'C1', sequence: 10, minimumPoints: 90, maximumPoints: 95, description: 'Autonome' },
  { name: 'C2', sequence: 11, minimumPoints: 95, maximumPoints: 101, description: 'Maîtrise' },
] as const;

const TRAININGS = [
  { frName: 'Anglais', arName: 'الإنجليزية', code: 'ANG' },
  { frName: 'Français', arName: 'الفرنسية', code: 'FRA' },
  { frName: 'Arabe', arName: 'العربية', code: 'ARA' },
  { frName: 'Allemand', arName: 'الألمانية', code: 'ALL' },
  { frName: 'Espagnol', arName: 'الإسبانية', code: 'ESP' },
  { frName: 'Turc', arName: 'التركية', code: 'TUR' },
] as const;

const FACULTIES = [
  'Faculté des Sciences Exactes et de l’Informatique',
  'Faculté des Sciences de la Nature et de la Vie',
  'Faculté des Sciences et de la Technologie',
  'Faculté des Lettres et des Arts',
  'Faculté des Langues Étrangères',
  'Faculté de Droit et des Sciences Politiques',
  'Faculté des Sciences Économiques, Commerciales et de Gestion',
  'Faculté des Sciences Sociales',
  'Institut d’Éducation Physique et Sportive',
] as const;

const STUDENT_CATEGORIES = [
  { name: 'Étudiant', description: 'Étudiant inscrit à l’université' },
  { name: 'Enseignant', description: 'Enseignant-chercheur' },
  { name: 'Personnel ATS', description: 'Personnel administratif, technique et de service' },
  { name: 'Externe', description: 'Participant hors université' },
  { name: 'Boursier', description: 'Participant bénéficiant d’une prise en charge' },
] as const;

const SPECIALITIES = [
  { name: 'Informatique', arName: 'الإعلام الآلي' },
  { name: 'Biologie', arName: 'البيولوجيا' },
  { name: 'Droit', arName: 'الحقوق' },
  { name: 'Sciences économiques', arName: 'العلوم الاقتصادية' },
  { name: 'Langue et littérature arabes', arName: 'اللغة والأدب العربي' },
  { name: 'Génie civil', arName: 'الهندسة المدنية' },
] as const;

const TEACHERS = [
  { name: 'BENSAADA Karim', teacherType: TeacherType.PERMANENT, email: 'k.bensaada@ceil.local' },
  { name: 'HAMDANI Leïla', teacherType: TeacherType.PERMANENT, email: 'l.hamdani@ceil.local' },
  { name: 'OULD KADA Sofiane', teacherType: TeacherType.VACATAIRE, email: 's.ouldkada@ceil.local' },
  { name: 'ZEROUAL Nadia', teacherType: TeacherType.VACATAIRE, email: 'n.zeroual@ceil.local' },
] as const;

/**
 * Gabarits de groupes : `isTemplate = true`, sans session. L'organisation d'une
 * session les instancie en groupes réels (`isTemplate = false`).
 */
const GROUP_TEMPLATES = [
  { name: 'Groupe 1', groupType: GroupType.SESSION, sequence: 1, capacity: 25 },
  { name: 'Groupe 2', groupType: GroupType.SESSION, sequence: 2, capacity: 25 },
  { name: 'Groupe 3', groupType: GroupType.SESSION, sequence: 3, capacity: 25 },
  { name: 'Groupe 4', groupType: GroupType.SESSION, sequence: 4, capacity: 25 },
  { name: 'Salle A', groupType: GroupType.EXAM, sequence: 1, capacity: 40 },
  { name: 'Salle B', groupType: GroupType.EXAM, sequence: 2, capacity: 40 },
  { name: 'Salle C', groupType: GroupType.EXAM, sequence: 3, capacity: 30 },
] as const;

const DEFAULT_DIPLOMA_MODEL_NAME = 'Modèle officiel CEIL';

// ---------------------------------------------------------------------------

async function seedTrainingLevels() {
  for (const level of TRAINING_LEVELS) {
    await prisma.trainingLevel.upsert({
      where: { name: level.name },
      update: {
        sequence: level.sequence,
        minimumPoints: level.minimumPoints,
        maximumPoints: level.maximumPoints,
        description: level.description,
      },
      create: { ...level },
    });
  }
  console.log(`  ✓ ${TRAINING_LEVELS.length} niveaux CECRL`);
}

async function seedTrainings() {
  const levels = await prisma.trainingLevel.findMany({ select: { id: true } });

  for (const training of TRAININGS) {
    await prisma.training.upsert({
      where: { frName: training.frName },
      update: {
        arName: training.arName,
        code: training.code,
        // `set` rend l'association idempotente : on ne cumule pas les niveaux.
        levels: { set: levels.map(({ id }) => ({ id })) },
      },
      create: {
        ...training,
        levels: { connect: levels.map(({ id }) => ({ id })) },
      },
    });
  }
  console.log(`  ✓ ${TRAININGS.length} formations, chacune reliée aux ${levels.length} niveaux`);
}

async function seedDiplomaModel() {
  const heading = [
    '<div style="text-align:center">',
    '<div>الجمهورية الجزائرية الديمقراطية الشعبية</div>',
    '<div>وزارة التعليم العالي والبحث العلمي</div>',
    '<div>جامعة عبد الحميد بن باديس — مستغانم</div>',
    '<div>مركز التعليم المكثف للغات</div>',
    '<hr />',
    '<div>Université Abdelhamid Ibn Badis — Mostaganem</div>',
    '<div>Centre d’Enseignement Intensif des Langues</div>',
    '</div>',
  ].join('');

  await prisma.diplomaModel.upsert({
    where: { name: DEFAULT_DIPLOMA_MODEL_NAME },
    update: { isDefault: true, disabled: false, heading },
    create: { name: DEFAULT_DIPLOMA_MODEL_NAME, isDefault: true, heading },
  });

  // Invariant : au plus un modèle par défaut actif.
  await prisma.diplomaModel.updateMany({
    where: { name: { not: DEFAULT_DIPLOMA_MODEL_NAME }, isDefault: true },
    data: { isDefault: false },
  });

  console.log(`  ✓ modèle de diplôme par défaut « ${DEFAULT_DIPLOMA_MODEL_NAME} »`);
}

async function seedReferentials() {
  for (const name of FACULTIES) {
    await prisma.faculty.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`  ✓ ${FACULTIES.length} facultés`);

  for (const category of STUDENT_CATEGORIES) {
    await prisma.studentCategory.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: { ...category },
    });
  }
  console.log(`  ✓ ${STUDENT_CATEGORIES.length} catégories de participant`);

  for (const speciality of SPECIALITIES) {
    await prisma.speciality.upsert({
      where: { name: speciality.name },
      update: { arName: speciality.arName },
      create: { ...speciality },
    });
  }
  console.log(`  ✓ ${SPECIALITIES.length} spécialités`);

  for (const teacher of TEACHERS) {
    const existing = await prisma.teacher.findFirst({ where: { name: teacher.name } });
    if (existing) {
      await prisma.teacher.update({ where: { id: existing.id }, data: { ...teacher } });
    } else {
      await prisma.teacher.create({ data: { ...teacher } });
    }
  }
  console.log(`  ✓ ${TEACHERS.length} enseignants`);
}

async function seedGroupTemplates() {
  for (const template of GROUP_TEMPLATES) {
    const existing = await prisma.studentGroup.findFirst({
      where: { name: template.name, groupType: template.groupType, isTemplate: true },
    });

    if (existing) {
      await prisma.studentGroup.update({
        where: { id: existing.id },
        data: { sequence: template.sequence, capacity: template.capacity, disabled: false },
      });
    } else {
      await prisma.studentGroup.create({
        data: { ...template, isTemplate: true, trainingSessionId: null },
      });
    }
  }
  console.log(`  ✓ ${GROUP_TEMPLATES.length} gabarits de groupes (session + examen)`);
}

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

const DEMO_SESSION_CODE = 'DEMO-ANG-2526';
const DEMO_TEST_TITLE = 'Test de positionnement — Anglais 2025-2026';

/**
 * Session de démonstration : sans elle, l'espace de travail — écran principal
 * de l'application — n'aurait rien à afficher au premier lancement.
 */
async function seedDemoSession() {
  const training = await prisma.training.findUnique({ where: { frName: 'Anglais' } });
  if (!training) return;

  const session = await prisma.trainingSession.upsert({
    where: { code: DEMO_SESSION_CODE },
    update: {},
    create: {
      code: DEMO_SESSION_CODE,
      trainingId: training.id,
      academicYear: '2025-2026',
      dateFrom: new Date('2025-10-01'),
      dateTo: new Date('2026-06-30'),
      admissionThreshold: 50,
      matriculePrefix: 'CEIL-ANG-2526',
      mode: 'PRESENTIAL',
      status: 'SCHEDULED',
    },
  });

  const existingTest = await prisma.positioningTest.findFirst({
    where: { title: DEMO_TEST_TITLE },
  });
  if (!existingTest) {
    await prisma.positioningTest.create({
      data: { title: DEMO_TEST_TITLE, trainingId: training.id, date: new Date('2025-09-20') },
    });
  }

  console.log(`  ✓ session de démonstration « ${DEMO_SESSION_CODE} » + test de positionnement`);
  return session;
}

async function main() {
  console.log('Seed CEIL —');
  await seedTrainingLevels();
  await seedTrainings();
  await seedDiplomaModel();
  await seedReferentials();
  await seedGroupTemplates();
  await seedUsers();
  await seedDemoSession();
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
