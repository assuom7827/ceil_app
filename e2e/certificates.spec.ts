/**
 * Gabarit d'attestation : téléversement, remplissage, PDF.
 *
 * Ce parcours est le seul qui traverse réellement les routes HTTP — le
 * multipart, le RBAC, les en-têtes de fichier et la conversion LibreOffice.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };
const USER = { email: 'user@ceil.local', password: 'Ceil@User2025!' };

async function login(page: Page, account = MANAGER) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  /**
   * Délai élargi : sur un serveur de développement qui vient de démarrer, la
   * première soumission compile la route et dépasse les 5 s par défaut. Le
   * défaut serait alors imputé à la connexion, qui n'y est pour rien.
   */
  await expect(page).toHaveURL('/', { timeout: 30_000 });
}

/** Le gabarit distribué dans `docs/` : celui que le CEIL ouvrira dans LibreOffice. */
const TEMPLATE = readFileSync('docs/modele-attestation.odt');

/** Session avec un modèle de diplôme dédié, un admis et un ajourné. */
async function certificateSession(page: Page) {
  const suffix = Date.now().toString().slice(-6);

  const model = (await (
    await page.request.post('/api/diploma-models', { data: { name: `Attestation ${suffix}` } })
  ).json()) as { id: string };

  const trainings = (await (await page.request.get('/api/trainings?q=Anglais')).json()) as {
    data: Array<{ id: string }>;
  };
  const session = (await (
    await page.request.post('/api/sessions', {
      data: {
        trainingId: trainings.data[0]!.id,
        academicYear: '2025-2026',
        dateFrom: '2025-10-01',
        dateTo: '2026-06-30',
        admissionThreshold: 50,
        matriculePrefix: `ATT-${suffix}`,
        diplomaModelId: model.id,
      },
    })
  ).json()) as { id: string };

  await page.request.post(`/api/sessions/${session.id}/enroll`, {
    data: {
      participantIds: [],
      newParticipants: [
        { familyName: 'BOUSSAHELA', firstName: 'Zakaria' },
        { familyName: 'AJOURNE', firstName: 'Test' },
      ],
    },
  });

  const enrollments = (await (
    await page.request.get(`/api/sessions/${session.id}/enrollments`)
  ).json()) as { rows: Array<{ id: string; participant: { familyName: string | null } }> };

  const admis = enrollments.rows.find((row) => row.participant.familyName === 'BOUSSAHELA')!;
  const ajourne = enrollments.rows.find((row) => row.participant.familyName === 'AJOURNE')!;

  // 60 ≥ 50 pour l'un, 5 < 50 pour l'autre. Le champ est `entries` : un corps
  // mal formé serait refusé en 400 et la session resterait sans note, ce qui
  // ferait échouer les tests pour la mauvaise raison — d'où la vérification.
  const saved = await page.request.put(`/api/sessions/${session.id}/deliberation`, {
    data: {
      entries: [
        {
          enrollmentId: admis.id,
          oralExpression: 15,
          writtenExpression: 15,
          oralComprehension: 15,
          writtenComprehension: 15,
        },
        { enrollmentId: ajourne.id, oralExpression: 5 },
      ],
    },
  });
  expect(saved.status()).toBe(200);

  return { sessionId: session.id, modelId: model.id, admis, ajourne };
}

test.describe.configure({ mode: 'serial' });

test.describe('gabarit d’attestation', () => {
  test('téléverse le gabarit et rend compte de ses repères', async ({ page }) => {
    await login(page);
    const { modelId } = await certificateSession(page);

    const response = await page.request.post(`/api/diploma-models/${modelId}/template`, {
      multipart: {
        file: {
          name: 'modele-attestation.odt',
          mimeType: 'application/vnd.oasis.opendocument.text',
          buffer: TEMPLATE,
        },
      },
    });

    expect(response.status()).toBe(201);
    const report = (await response.json()) as {
      fileName: string;
      placeholders: string[];
      unknownPlaceholders: string[];
    };
    expect(report.fileName).toBe('modele-attestation.odt');
    expect(report.placeholders).toContain('nomCompletArabe');
    // Le gabarit distribué ne doit contenir aucun repère que le code ignore.
    expect(report.unknownPlaceholders).toEqual([]);
  });

  test('refuse un fichier qui n’est pas un ODT', async ({ page }) => {
    await login(page);
    const { modelId } = await certificateSession(page);

    const response = await page.request.post(`/api/diploma-models/${modelId}/template`, {
      multipart: {
        file: { name: 'liste.csv', mimeType: 'text/csv', buffer: Buffer.from('Nom,Prenom\n') },
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toContain('ODT');
  });

  test('produit un PDF pour l’admis, et le refuse à l’ajourné', async ({ page }) => {
    await login(page);
    const { sessionId, modelId, admis, ajourne } = await certificateSession(page);
    await page.request.post(`/api/diploma-models/${modelId}/template`, {
      multipart: {
        file: {
          name: 'modele-attestation.odt',
          mimeType: 'application/vnd.oasis.opendocument.text',
          buffer: TEMPLATE,
        },
      },
    });

    const pdf = await page.request.get(
      `/api/sessions/${sessionId}/certificates?enrollmentId=${admis.id}`,
    );
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    // Aucun repère ne doit rester visible sur un document officiel.
    expect(pdf.headers()['x-ceil-unresolved']).toBeUndefined();
    const body = await pdf.body();
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');

    const refused = await page.request.get(
      `/api/sessions/${sessionId}/certificates?enrollmentId=${ajourne.id}`,
    );
    expect(refused.status()).toBe(422);
  });

  test('rend l’ODT rempli pour retouche avant impression', async ({ page }) => {
    await login(page);
    const { sessionId, modelId } = await certificateSession(page);
    await page.request.post(`/api/diploma-models/${modelId}/template`, {
      multipart: {
        file: {
          name: 'modele-attestation.odt',
          mimeType: 'application/vnd.oasis.opendocument.text',
          buffer: TEMPLATE,
        },
      },
    });

    const odt = await page.request.get(`/api/sessions/${sessionId}/certificates?format=odt`);
    expect(odt.status()).toBe(200);
    expect(odt.headers()['content-type']).toBe('application/vnd.oasis.opendocument.text');
    expect(odt.headers()['x-ceil-certificates']).toBe('1'); // un seul admis
  });

  test('explique l’absence de gabarit au lieu d’échouer sourdement', async ({ page }) => {
    await login(page);
    const { sessionId } = await certificateSession(page);

    const response = await page.request.get(`/api/sessions/${sessionId}/certificates`);
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toContain('gabarit');
  });

  /**
   * Le gabarit suit exactement les droits de la ressource `DiplomaModel`, sans
   * chemin détourné : anonyme refusé, et `USER` autorisé comme sur le reste du
   * modèle de diplôme (D-11 ne place pas cette ressource en lecture seule).
   *
   * Réserver le gabarit aux responsables serait défendable — il porte la mise en
   * page de documents officiels — mais c'est une décision de politique d'accès,
   * pas un effet de bord de cette fonctionnalité. Question ouverte consignée
   * dans `docs/etat-du-projet.md`.
   */
  test('applique les droits de la ressource, sans chemin détourné', async ({ page, browser }) => {
    await login(page, MANAGER);
    const { modelId } = await certificateSession(page);

    const upload = {
      multipart: {
        file: {
          name: 'modele-attestation.odt',
          mimeType: 'application/vnd.oasis.opendocument.text',
          buffer: TEMPLATE,
        },
      },
    };

    // Anonyme : aucun accès, ni en lecture ni en écriture.
    const anonyme = await browser.newContext();
    expect(
      (await anonyme.request.post(`/api/diploma-models/${modelId}/template`, upload)).status(),
    ).toBe(401);
    expect((await anonyme.request.get(`/api/diploma-models/${modelId}/template`)).status()).toBe(
      401,
    );
    await anonyme.close();

    /**
     * Contexte neuf pour le second rôle : déjà connecté, un visiteur est renvoyé
     * du formulaire de connexion vers le tableau de bord, et la page n'offre
     * plus de champ à remplir.
     */
    const context = await browser.newContext();
    const userPage = await context.newPage();
    await login(userPage, USER);
    expect(
      (await userPage.request.post(`/api/diploma-models/${modelId}/template`, upload)).status(),
    ).toBe(201);
    await context.close();
  });

  test('se gère depuis l’écran des modèles de diplôme', async ({ page }) => {
    await login(page);
    const { modelId } = await certificateSession(page);
    await page.request.post(`/api/diploma-models/${modelId}/template`, {
      multipart: {
        file: {
          name: 'modele-attestation.odt',
          mimeType: 'application/vnd.oasis.opendocument.text',
          buffer: TEMPLATE,
        },
      },
    });

    await page.goto('/references');
    await page.getByRole('tab', { name: 'Modèles de diplôme' }).click();
    await expect(
      page.getByRole('columnheader', { name: 'Gabarit d’attestation (ODT)' }),
    ).toBeVisible();
    await expect(page.getByText('modele-attestation.odt').first()).toBeVisible();

    // La liste des repères est servie depuis le module partagé, pas réécrite ici.
    await page.getByRole('button', { name: 'Repères disponibles' }).first().click();
    await expect(page.getByText('{{nomCompletArabe}}').first()).toBeVisible();
  });
});
