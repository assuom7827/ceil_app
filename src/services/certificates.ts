/**
 * Attestations de réussite produites depuis un gabarit ODT.
 *
 * Le gabarit est préparé dans LibreOffice par l'administration ; l'application
 * n'y remplit que les **valeurs variables**. Tout ce qui est fixe — logos,
 * en-têtes officiels, cadre décoratif, nom et titre du signataire, mentions
 * légales — vit dans le fichier, donc se change sans toucher au code.
 *
 * Aucune valeur n'est recalculée ici : noms, dates, mois arabes et statut
 * d'admission viennent de `derive.ts`, comme les écrans et le procès-verbal.
 */
import type { Db } from './db';
import { arabicMonthOfDate, type Nullable } from './derive';
import { getAttestationDocument, getDiplomaDocument, type DocumentHeader, type DocumentPerson } from './documents';
import { notFoundError, validationError } from './errors';
import {
  ATTESTATION_PLACEHOLDERS,
  CERTIFICATE_PLACEHOLDERS,
  KNOWN_PLACEHOLDER_NAMES,
  type PlaceholderDoc,
} from './certificate-placeholders';
import { fillTemplateMany, injectQrCodes, listTemplatePlaceholders } from './odt';
import QRCode from 'qrcode';

/**
 * Le catalogue est réexporté pour que l'API n'ait qu'un point d'entrée, mais il
 * VIT dans un module pur : l'écran des modèles l'importe aussi, et il ne doit
 * pas entraîner de code serveur dans le bundle du navigateur.
 */
export { ATTESTATION_PLACEHOLDERS, CERTIFICATE_PLACEHOLDERS, type PlaceholderDoc };

/** Sépare un nom composé « NOM Prénom » n'est PAS fait ici : les champs existent. */
function text(value: Nullable<string>): string {
  return value?.trim() ?? '';
}

function formatDate(value: Nullable<Date>, inverse = false): string {
  if (!value) return '';
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const year = value.getUTCFullYear();
  return inverse ? `${year}/${month}/${day}` : `${day}/${month}/${year}`;
}

async function generateQrCode(verificationUrl: string): Promise<Uint8Array | null> {
  try {
    return await QRCode.toBuffer(verificationUrl, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch {
    return null;
  }
}

/**
 * Civilité arabe.
 *
 * Sans sexe renseigné, la forme englobante est utilisée plutôt qu'un masculin
 * par défaut : une attestation officielle ne doit pas se tromper de personne.
 */
export function arabicCivility(gender: Nullable<'WOMAN' | 'MAN'>): string {
  if (gender === 'WOMAN') return 'السيدة';
  if (gender === 'MAN') return 'السيد';
  return 'السيد(ة)';
}

export interface CertificateContext {
  header: DocumentHeader;
  /** Mois de début de session en arabe — le « دورة أكتوبر » de l'attestation. */
  arabicMonthFrom: string | null;
  issuedOn: Date;
}

/** Valeurs des repères pour une personne. */
export function certificateValues(
  context: CertificateContext,
  person: CertificateRecipient,
): Record<string, string> {
  const { header } = context;
  const arabicMonthFrom = text(context.arabicMonthFrom);
  const yearFrom = header.yearFrom ? String(header.yearFrom) : '';

  return {
    nomLatin: text(person.familyName),
    prenomLatin: text(person.firstName),
    nomComplet: text(person.fullName),
    nomArabe: text(person.arabName),
    prenomArabe: text(person.arabFirstName),
    nomCompletArabe: text(person.arabicFullName),
    civiliteArabe: arabicCivility(person.gender),
    dateNaissance: text(person.birth),
    dateNaissanceInverse: formatDate(person.birthDate, true),
    lieuNaissance: text(person.birthPlace),
    lieuNaissanceArabe: text(person.arabicBirthPlace),
    langue: text(header.trainingFr),
    langueArabe: text(header.trainingAr) || text(header.trainingFr),
    niveau: text(person.levelName) || text(header.levelName),
    session: text(header.sessionTitle),
    sessionArabe: arabicMonthFrom ? `دورة ${arabicMonthFrom} ${yearFrom}`.trim() : '',
    anneeUniversitaire: text(header.academicYear),
    moisArabeDebut: arabicMonthFrom,
    moisArabeFin: text(header.arabicMonthTo),
    anneeDebut: yearFrom,
    anneeFin: header.yearTo ? String(header.yearTo) : '',
    matricule: text(person.registrationNumber),
    matriculeParticipant: text(person.participantNumber),
    total: person.total === null ? '' : String(person.total),
    seuil: String(header.admissionThreshold),
    dateDelivrance: formatDate(context.issuedOn),
    dateDelivranceInverse: formatDate(context.issuedOn, true),
  };
}

export interface CertificateRecipient extends DocumentPerson {
  familyName: string | null;
  firstName: string | null;
  arabName: string | null;
  arabFirstName: string | null;
  gender: 'WOMAN' | 'MAN' | null;
  birthDate: Date | null;
}

export interface CertificateReport {
  file: Uint8Array;
  fileName: string;
  count: number;
  /** Repères du gabarit qu'aucune donnée ne renseigne, laissés visibles. */
  unresolved: string[];
}

export interface AttestationValuesResult {
  values: Record<string, string>;
  qrCode: Uint8Array | null;
}

export async function attestationValues(
  header: DocumentHeader,
  person: DocumentPerson,
  now: Date = new Date(),
): Promise<AttestationValuesResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/verify/${header.sessionId}/${person.enrollmentId}`;
  const qrCode = await generateQrCode(verificationUrl);

  return {
    values: {
      anneeUniversitaire: text(header.academicYear),
      institution: 'Université Abdelhamid Ibn Badis — Mostaganem',
      civiliteArabe: arabicCivility(person.gender),
      nomCompletArabe: text(person.arabicFullName) || text(person.fullName),
      dateNaissance: text(person.birth),
      dateNaissanceInverse: person.birthDate ? formatDate(person.birthDate, true) : '',
      lieuNaissanceArabe: text(person.arabicBirthPlace) || text(person.birthPlace),
      matricule: text(person.registrationNumber),
      langue: text(header.trainingFr),
      langueArabe: text(header.trainingAr) || text(header.trainingFr),
      niveau: text(person.levelName) || text(header.levelName),
      groupe: text(person.groupName) || '',
      lieuEdition: 'Mostaganem',
      dateEdition: formatDate(now),
      dateEditionInverse: formatDate(now, true),
      directeur: 'Le Directeur',
    },
    qrCode,
  };
}

/**
 * Repères d'un gabarit que l'application ne sait pas remplir.
 *
 * Une faute de frappe (`{{niveaux}}`) s'imprimerait telle quelle sur un document
 * officiel : la lister au téléversement évite de le découvrir sur papier.
 */
export function unknownPlaceholders(file: Uint8Array): string[] {
  return listTemplatePlaceholders(file).filter((name) => !KNOWN_PLACEHOLDER_NAMES.has(name));
}

/** Gabarit d'attestation retenu pour une session, ou `null`. */
export async function findCertificateTemplate(
  db: Db,
  trainingSessionId: string,
  kind: 'CERTIFICATE' | 'ATTESTATION' = 'CERTIFICATE',
): Promise<{ id: string; fileName: string; content: Uint8Array } | null> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { diplomaModelId: true, diplomaModel: { select: { disabled: true } } },
  });
  if (!session) {
    throw notFoundError('Session de formation introuvable.', { trainingSessionId });
  }

  const usable = session.diplomaModelId && !session.diplomaModel?.disabled;
  const template = usable
    ? await db.documentTemplate.findUnique({
        where: {
          diplomaModelId_kind: { diplomaModelId: session.diplomaModelId!, kind },
        },
        select: { id: true, fileName: true, content: true },
      })
    : null;
  if (template) return asTemplate(template);

  const fallback = await db.diplomaModel.findFirst({
    where: { isDefault: true, disabled: false },
    select: {
      templates: {
        where: { kind },
        select: { id: true, fileName: true, content: true },
      },
    },
  });
  const [defaultTemplate] = fallback?.templates ?? [];
  return defaultTemplate ? asTemplate(defaultTemplate) : null;
}

function asTemplate(row: { id: string; fileName: string; content: Uint8Array | Buffer }) {
  return { id: row.id, fileName: row.fileName, content: new Uint8Array(row.content) };
}

/**
 * Produit l'ODT rempli des attestations d'une session.
 *
 * Sans `enrollmentId`, toutes les personnes **admises** sont servies, une page
 * par personne — le filtre d'admission est celui de `getDiplomaDocument`, donc
 * un ajourné ne peut pas recevoir d'attestation de réussite par ce chemin.
 */
export async function buildCertificateOdt(
  db: Db,
  trainingSessionId: string,
  enrollmentId?: string,
  now: Date = new Date(),
): Promise<CertificateReport> {
  const template = await findCertificateTemplate(db, trainingSessionId);
  if (!template) {
    throw validationError(
      'Aucun gabarit d’attestation n’est téléversé pour cette session. Ajoutez-en un depuis Référentiels → Modèles de diplôme.',
      { trainingSessionId },
    );
  }

  const { header, people } = await getDiplomaDocument(db, trainingSessionId, enrollmentId);
  if (people.length === 0) {
    throw validationError('Aucun admis dans cette session : rien à éditer.', { trainingSessionId });
  }

  const context: CertificateContext = {
    header,
    arabicMonthFrom: await loadArabicMonthFrom(db, trainingSessionId),
    issuedOn: now,
  };

  const recipients = await withCivilStatus(db, people);
  const rendered = fillTemplateMany(
    template.content,
    recipients.map((person) => certificateValues(context, person)),
  );

  return {
    file: rendered.file,
    fileName: template.fileName,
    count: recipients.length,
    unresolved: rendered.unresolved,
  };
}

/**
 * Produit l'ODT rempli des attestations d'inscription d'une session.
 *
 * Sans `enrollmentId`, toutes les inscriptions sont servies, une page par
 * personne — quel que soit le statut de délibération.
 */
export async function buildAttestationOdt(
  db: Db,
  trainingSessionId: string,
  enrollmentId?: string,
  now: Date = new Date(),
): Promise<CertificateReport> {
  const template = await findCertificateTemplate(db, trainingSessionId, 'ATTESTATION');
  if (!template) {
    throw validationError(
      'Aucun gabarit d’attestation d’inscription n’est téléversé pour cette session. Ajoutez-en un depuis Référentiels → Modèles de diplôme.',
      { trainingSessionId },
    );
  }

  const { header, people } = await getAttestationDocument(db, trainingSessionId, enrollmentId);
  if (people.length === 0) {
    throw validationError('Aucune inscription dans cette session : rien à éditer.', { trainingSessionId });
  }

  const values = await Promise.all(people.map((person) => attestationValues(header, person, now)));

  const qrCodes = values
    .map((result, index) => ({ enrollmentId: people[index]!.enrollmentId, data: result.qrCode }))
    .filter((qr): qr is { enrollmentId: string; data: Uint8Array } => qr.data !== null);

  const withQrCodes = injectQrCodes(template.content, qrCodes);
  const rendered = fillTemplateMany(withQrCodes, values.map((v) => v.values));

  return {
    file: rendered.file,
    fileName: template.fileName,
    count: people.length,
    unresolved: rendered.unresolved,
  };
}

async function loadArabicMonthFrom(db: Db, trainingSessionId: string): Promise<string | null> {
  const session = await db.trainingSession.findUnique({
    where: { id: trainingSessionId },
    select: { dateFrom: true },
  });
  return arabicMonthOfDate(session?.dateFrom ?? null);
}

/**
 * Complète les personnes du procès-verbal avec l'état civil détaillé.
 *
 * Le document officiel a besoin du nom et du prénom SÉPARÉMENT — la boîte
 * latine de l'attestation les présente sur deux lignes — là où les écrans se
 * contentent du nom composé.
 */
async function withCivilStatus(
  db: Db,
  people: readonly DocumentPerson[],
): Promise<CertificateRecipient[]> {
  const rows = await db.enrollment.findMany({
    where: { id: { in: people.map((person) => person.enrollmentId) } },
    select: {
      id: true,
      participant: {
        select: {
          familyName: true,
          firstName: true,
          arabName: true,
          arabFirstName: true,
          gender: true,
          birthDate: true,
          birthDateIsApproximate: true,
        },
      },
    },
  });
  const byEnrollment = new Map(rows.map((row) => [row.id, row.participant]));

  return people.map((person) => {
    const participant = byEnrollment.get(person.enrollmentId);
    return {
      ...person,
      familyName: participant?.familyName ?? null,
      firstName: participant?.firstName ?? null,
      arabName: participant?.arabName ?? null,
      arabFirstName: participant?.arabFirstName ?? null,
      gender: participant?.gender ?? null,
      // Une date approximative n'a pas de jour : la forme inversée resterait
      // fausse. `birth` porte déjà la mention en clair.
      birthDate: participant?.birthDateIsApproximate ? null : (participant?.birthDate ?? null),
    };
  });
}
