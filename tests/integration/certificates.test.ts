/**
 * Attestations de réussite produites depuis un gabarit ODT.
 *
 * Ce qui est vérifié ici et nulle part ailleurs : le gabarit stocké en base est
 * bien celui qui sert, les valeurs sont celles de la délibération, et un ajourné
 * ne peut pas obtenir d'attestation de réussite.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  arabicCivility,
  buildCertificateOdt,
  findCertificateTemplate,
  unknownPlaceholders,
} from '@/services/certificates';
import { upsertDeliberationEntry } from '@/services/deliberation';
import { enroll } from '@/services/enrollment';
import { libreOfficeVersion, odtToPdf } from '@/services/odt-render';
import {
  createParticipants,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();
const hasLibreOffice = (await libreOfficeVersion()) !== null;

const ODT_MIME = 'application/vnd.oasis.opendocument.text';

const BODY =
  '<text:p>{{civiliteArabe}} {{nomCompletArabe}}</text:p>' +
  '<text:p>{{nomLatin}} / {{prenomLatin}} — {{niveau}} — {{langue}}</text:p>' +
  '<text:p>{{sessionArabe}} — {{dateNaissance}} — {{matricule}}</text:p>';

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';

const MANIFEST =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">' +
  `<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIME}"/>` +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '</manifest:manifest>';

/** Gabarit conforme à ce que produit LibreOffice : manifeste et espaces de noms. */
function buildTemplate(body = BODY): Uint8Array {
  const content =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<office:document-content ${NS} office:version="1.3"><office:automatic-styles/>` +
    `<office:body><office:text>${body}</office:text></office:body>` +
    '</office:document-content>';
  return zipSync({
    mimetype: [strToU8(ODT_MIME), { level: 0 }],
    'META-INF/manifest.xml': strToU8(MANIFEST),
    'content.xml': strToU8(content),
  });
}

function bodyOf(file: Uint8Array): string {
  return strFromU8(unzipSync(file)['content.xml']!);
}

async function setup(options: { withTemplate?: boolean; defaultTemplate?: boolean } = {}) {
  const { training, levels } = await createTraining();
  const model = await prisma.diplomaModel.create({
    data: { name: `Modèle ${Date.now()}`, isDefault: Boolean(options.defaultTemplate) },
  });
  if (options.withTemplate !== false) {
    await prisma.documentTemplate.create({
      data: {
        diplomaModelId: model.id,
        fileName: 'attestation.odt',
        content: Buffer.from(buildTemplate()),
      },
    });
  }

  const session = await prisma.trainingSession.create({
    data: {
      trainingId: training.id,
      academicYear: '2025-2026',
      admissionThreshold: 50,
      matriculePrefix: 'CEIL-ANG',
      dateFrom: new Date('2025-10-01'),
      dateTo: new Date('2026-06-15'),
      diplomaModelId: options.defaultTemplate ? null : model.id,
    },
  });

  const participants = await createParticipants(2);
  await prisma.participant.update({
    where: { id: participants[0]!.id },
    data: {
      familyName: 'BOUSSAHELA',
      firstName: 'Zakaria',
      arabName: 'بوسهلة',
      arabFirstName: 'زكرياء',
      gender: 'WOMAN',
      birthDate: new Date('2005-10-27'),
      birthPlace: 'Bir Eljir',
      arabBirthPlace: 'بئر الجير',
    },
  });

  await enroll(
    prisma,
    session.id,
    participants.map((p) => p.id),
  );
  const enrollments = await prisma.enrollment.findMany({
    where: { trainingSessionId: session.id },
    orderBy: { participant: { familyName: 'asc' } },
  });

  // Le premier est admis (60 ≥ 50), le second ajourné (20 < 50).
  await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, {
    oralExpression: 15,
    writtenExpression: 15,
    oralComprehension: 15,
    writtenComprehension: 15,
  });
  await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, { oralExpression: 20 });

  await prisma.enrollment.update({
    where: { id: enrollments[0]!.id },
    data: { assignedLevelId: levels[3]!.id },
  });

  return { model, session, enrollments, levels };
}

describe('civilité arabe', () => {
  it('accorde selon le sexe, et reste englobante sans information', () => {
    expect(arabicCivility('WOMAN')).toBe('السيدة');
    expect(arabicCivility('MAN')).toBe('السيد');
    expect(arabicCivility(null)).toBe('السيد(ة)');
  });
});

describe('repères inconnus', () => {
  it('signale une faute de frappe dans un repère', () => {
    const file = buildTemplate('<text:p>{{niveaux}} {{nomLatin}}</text:p>');
    expect(unknownPlaceholders(file)).toEqual(['niveaux']);
  });

  it('ne signale rien quand tous les repères sont connus', () => {
    expect(unknownPlaceholders(buildTemplate())).toEqual([]);
  });
});

describe.skipIf(!hasDb)('génération des attestations', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('remplit le gabarit avec les valeurs de la délibération', async () => {
    const { session, enrollments } = await setup();

    const built = await buildCertificateOdt(prisma, session.id, enrollments[0]!.id);
    const body = bodyOf(built.file);

    expect(built.count).toBe(1);
    expect(built.unresolved).toEqual([]);
    expect(body).toContain('السيدة بوسهلة زكرياء');
    expect(body).toContain('BOUSSAHELA / Zakaria');
    expect(body).toContain('27/10/2005');
    // « دورة » suivi du mois de DÉBUT de session, convention algérienne.
    expect(body).toContain('دورة أكتوبر 2025');
    expect(body).toContain(enrollments[0]!.registrationNumber!);
  });

  /** D-15 : le filtre d'admission vit dans le service, pas dans l'appelant. */
  it('refuse une attestation de réussite à un ajourné (422)', async () => {
    const { session, enrollments } = await setup();

    await expect(buildCertificateOdt(prisma, session.id, enrollments[1]!.id)).rejects.toMatchObject(
      { code: 'UNPROCESSABLE', status: 422 },
    );
  });

  it('distingue une inscription inconnue d’un refus métier (404)', async () => {
    const { session } = await setup();
    await expect(buildCertificateOdt(prisma, session.id, 'inexistant')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('n’édite que les admis quand aucune inscription n’est précisée', async () => {
    const { session } = await setup();
    const built = await buildCertificateOdt(prisma, session.id);

    expect(built.count).toBe(1); // un seul admis sur deux inscrits
    expect(bodyOf(built.file)).toContain('BOUSSAHELA');
  });

  it('explique clairement l’absence de gabarit', async () => {
    const { session } = await setup({ withTemplate: false });
    await expect(buildCertificateOdt(prisma, session.id)).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 400,
    });
  });

  /** Même règle que les documents HTML : le modèle par défaut prend le relais. */
  it('retombe sur le gabarit du modèle par défaut si la session n’en désigne aucun', async () => {
    const { session } = await setup({ defaultTemplate: true });
    expect(await findCertificateTemplate(prisma, session.id)).not.toBeNull();
    expect((await buildCertificateOdt(prisma, session.id)).count).toBe(1);
  });

  it('ignore le gabarit d’un modèle désactivé', async () => {
    const { session, model } = await setup();
    await prisma.diplomaModel.update({ where: { id: model.id }, data: { disabled: true } });

    expect(await findCertificateTemplate(prisma, session.id)).toBeNull();
  });

  it('produit une page par admis', async () => {
    const { session, enrollments } = await setup();
    // Le second admis à son tour : deux attestations attendues.
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, {
      oralExpression: 20,
      writtenExpression: 20,
      oralComprehension: 20,
      writtenComprehension: 20,
    });

    const built = await buildCertificateOdt(prisma, session.id);
    expect(built.count).toBe(2);
    expect(bodyOf(built.file).match(/CeilSautDePage"\/>/g)).toHaveLength(1);
  });
});

/**
 * La conversion dépend de LibreOffice. Sans lui, la suite est IGNORÉE plutôt que
 * rouge — mais son absence est un défaut de serveur, pas une option : voir
 * `docs/exploitation.md`.
 */
describe.skipIf(!hasDb || !hasLibreOffice)('conversion en PDF', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('produit un PDF d’une page par admis', async () => {
    const { session, enrollments } = await setup();
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, {
      oralExpression: 20,
      writtenExpression: 20,
      oralComprehension: 20,
      writtenComprehension: 20,
    });

    const built = await buildCertificateOdt(prisma, session.id);
    const pdf = await odtToPdf(built.file);
    const header = strFromU8(pdf.subarray(0, 8));

    expect(header.startsWith('%PDF-')).toBe(true);
    // Une entrée /Type/Page par attestation.
    expect(strFromU8(pdf).match(/MediaBox/g)?.length).toBe(2);
  }, 120_000);
});
