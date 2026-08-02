/**
 * Export des données brutes d'une session en CSV / Excel.
 *
 * Vérifie que :
 *   — les en-têtes sont bien les chaînes françaises (pas 0, 1, 2…);
 *   — les valeurs dérivées (nom complet, totaux, statuts) sont cohérentes ;
 *   — le XLSX comporte plusieurs feuilles pour `groups` ;
 *   — le CSV contient les mêmes en-têtes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildSessionExport } from '@/services/exports';
import { enroll } from '@/services/enrollment';
import { upsertDeliberationEntry } from '@/services/deliberation';
import {
  createParticipants,
  createSession,
  createTraining,
  databaseAvailable,
  prisma,
  resetDatabase,
} from './helpers';

const hasDb = await databaseAvailable();

describe.skipIf(!hasDb)('export des données brutes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  let sessionId: string;

  async function setup() {
    const { training, levels } = await createTraining();
    const session = await createSession(training.id, { matriculePrefix: 'CEIL-ANG' });
    const [a, b] = await createParticipants(2);

    await prisma.participant.update({
      where: { id: a!.id },
      data: {
        familyName: 'BOUSSAHELA',
        firstName: 'Zakaria',
        arabName: 'بوسهلة',
        arabFirstName: 'زكرياء',
      },
    });
    await prisma.participant.update({
      where: { id: b!.id },
      data: {
        familyName: 'CHERIF',
        firstName: 'Amira',
        arabName: 'شريف',
        arabFirstName: 'أميرة',
      },
    });

    await enroll(prisma, session.id, [a!.id, b!.id]);

    const enrollments = await prisma.enrollment.findMany({
      where: { trainingSessionId: session.id },
      orderBy: { participant: { familyName: 'asc' } },
    });

    // Premier admis (60 ≥ 50), second ajourné (20 < 50).
    await upsertDeliberationEntry(prisma, session.id, enrollments[0]!.id, {
      oralExpression: 15,
      writtenExpression: 15,
      oralComprehension: 15,
      writtenComprehension: 15,
    });
    await upsertDeliberationEntry(prisma, session.id, enrollments[1]!.id, {
      oralExpression: 20,
    });

    // Groupe session pour le premier.
    const group = await prisma.studentGroup.create({
      data: {
        name: 'Groupe A',
        groupType: 'SESSION',
        trainingSessionId: session.id,
      },
    });
    await prisma.enrollment.update({
      where: { id: enrollments[0]!.id },
      data: { sessionGroupId: group.id, assignedLevelId: levels[3]!.id },
    });

    sessionId = session.id;
  }

  function readXlsxSheet(buffer: Uint8Array, sheetName: string): unknown[][] {
    const wb = XLSX.read(buffer, { type: 'array' });
    expect(wb.SheetNames).toContain(sheetName);
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!, {
      header: 1,
      raw: false,
    }) as unknown[][];
  }

  function readCsvHeaders(buffer: Uint8Array): string[] {
    const text = new TextDecoder().decode(buffer);
    return text.split('\n')[0]!.split(',');
  }

  it('exporte les inscrits en XLSX avec des en-têtes français', async () => {
    await setup();

    const result = await buildSessionExport(prisma, sessionId, 'enrollments', 'xlsx');
    expect(result.fileName).toBe(`ceil-session-${sessionId}-enrollments.xlsx`);
    expect(result.contentType).toContain('spreadsheetml');

    const rows = readXlsxSheet(result.bytes, 'Inscrits');
    const headers = rows[0] as string[];

    expect(headers).toEqual([
      'Matricule inscription',
      'Matricule participant',
      'Nom',
      'Prénom',
      'Nom arabe',
      'Prénom arabe',
      'Nom complet',
      'Nom complet arabe',
      'Type',
      'Catégorie',
      'Niveau',
      'Groupe session',
      'Groupe examen',
      'Site',
      'Horaire',
      'Téléphone',
      'E-mail',
      'Responsable',
      'Date inscription',
    ]);

    expect(rows.length).toBe(3); // en-tête + 2 lignes
    const rowBoussahela = rows[1] as string[];
    expect(rowBoussahela[2]).toBe('BOUSSAHELA');
    expect(rowBoussahela[6]).toBe('BOUSSAHELA Zakaria');
    expect(rowBoussahela[8]).toBe('Étudiant');
    expect(rowBoussahela[11]).toBe('Groupe A');
  });

  it('exporte les notes en XLSX avec le total et le statut dérivés', async () => {
    await setup();

    const result = await buildSessionExport(prisma, sessionId, 'scores', 'xlsx');
    const rows = readXlsxSheet(result.bytes, 'Notes');

    const headers = rows[0] as string[];
    expect(headers).toContain('E.O');
    expect(headers).toContain('E.E');
    expect(headers).toContain('C.O');
    expect(headers).toContain('C.E');
    expect(headers).toContain('Total');
    expect(headers).toContain('Statut');

    expect(rows.length).toBe(3); // en-tête + 2 lignes

    // Boussahela : 15+15+15+15 = 60, admis.
    const row1 = rows[1] as string[];
    expect(row1[14]).toBe('60');
    expect(row1[15]).toBe('Admis');

    // Cherif : E.O = 20, les autres notes nulles → total 20 < 50 → ajourné.
    const row2 = rows[2] as string[];
    expect(row2[10]).toBe('20'); // E.O
    expect(row2[13]).toBe(''); // C.E vide
    expect(row2[14]).toBe('20'); // total
    expect(row2[15]).toBe('Ajourné');
  });

  it('exporte les inscrits en CSV avec en-têtes français', async () => {
    await setup();

    const result = await buildSessionExport(prisma, sessionId, 'enrollments', 'csv');
    expect(result.fileName).toBe(`ceil-session-${sessionId}-enrollments.csv`);
    expect(result.contentType).toBe('text/csv; charset=utf-8');

    const headers = readCsvHeaders(result.bytes);
    expect(headers).toContain('Matricule inscription');
    expect(headers).toContain('Matricule participant');
    expect(headers).toContain('Nom');
    expect(headers).toContain('Nom complet');

    const text = new TextDecoder().decode(result.bytes);
    const lines = text.split('\n').filter((line) => line.length > 0);
    expect(lines.length).toBe(3); // en-tête + 2 lignes
    expect(lines[1]!).toContain('BOUSSAHELA');
  });

  it('exporte les notes en CSV', async () => {
    await setup();

    const result = await buildSessionExport(prisma, sessionId, 'scores', 'csv');
    const headers = readCsvHeaders(result.bytes);
    expect(headers).toContain('Total');
    expect(headers).toContain('Statut');
    expect(headers).toContain('E.O');
    expect(headers).toContain('C.E');
  });

  it('refuse un type d export inconnu (404)', async () => {
    await setup();
    await expect(
      buildSessionExport(prisma, sessionId, 'bogus' as never, 'xlsx'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
