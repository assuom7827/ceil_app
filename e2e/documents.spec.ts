import { expect, test, type Page } from '@playwright/test';

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
  await page.getByLabel('Mot de passe').fill(MANAGER.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/');
}

/**
 * Session créée pour ces tests, avec une date de fin connue : les documents
 * portent le mois de fin en arabe, on ne peut donc pas dépendre d'une session
 * résiduelle dont les dates seraient absentes.
 */
async function documentSession(page: Page): Promise<string> {
  const trainings = (await (await page.request.get('/api/trainings?q=Anglais')).json()) as {
    data: Array<{ id: string }>;
  };

  const session = (await (
    await page.request.post('/api/sessions', {
      data: {
        trainingId: trainings.data[0]!.id,
        academicYear: '2025-2026',
        dateFrom: '2025-10-01',
        dateTo: '2026-06-30', // juin → « جوان »
        admissionThreshold: 50,
        matriculePrefix: `DOC-${Date.now().toString().slice(-6)}`,
      },
    })
  ).json()) as { id: string };

  await page.request.post(`/api/sessions/${session.id}/enroll`, {
    data: {
      participantIds: [],
      newParticipants: [{ familyName: 'DOCUMENT', firstName: 'Test' }],
    },
  });

  return session.id;
}

test.describe('documents imprimables', () => {
  test('le procès-verbal affiche le tableau et la date en français', async ({ page }) => {
    await login(page);
    const sessionId = await documentSession(page);
    await page.goto(`/print/sessions/${sessionId}/minutes`);

    // Le PV se pagine : un titre par feuille dès que la session dépasse une page.
    await expect(page.getByRole('heading', { name: 'محضر المداولة' }).first()).toBeVisible();
    await expect(page.getByText('Procès-verbal de délibération').first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Décision' }).first()).toBeVisible();

    // Le mois de fin de session (juin 2026) doit apparaître en français.
    await expect(page.getByText(/juin/)).toBeVisible();
    // Le pied de page ne comporte ni directeur, ni texte arabe.
    await expect(page.getByText('Le Directeur')).toHaveCount(0);
    await expect(page.getByText('المدير')).toHaveCount(0);
  });

  test('les blocs arabes sont rendus en sens de lecture inversé', async ({ page }) => {
    await login(page);
    const sessionId = await documentSession(page);
    await page.goto(`/print/sessions/${sessionId}/minutes`);

    const rtl = page.locator('.rtl-block').first();
    await expect(rtl).toHaveCSS('direction', 'rtl');
  });

  test('la liste des participants prévoit une colonne d’émargement', async ({ page }) => {
    await login(page);
    const sessionId = await documentSession(page);
    await page.goto(`/print/sessions/${sessionId}/list`);

    await expect(page.getByRole('heading', { name: 'قائمة المشاركين' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Émargement' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الاسم واللقب' }).first()).toBeVisible();
  });

  test('les attestations sont accessibles depuis l’onglet Documents', async ({ page }) => {
    await login(page);
    const sessionId = await documentSession(page);
    await page.goto(`/sessions/${sessionId}/workspace`);
    await page.getByRole('tab', { name: 'Documents' }).click();

    await expect(page.getByText('Procès-verbal de délibération')).toBeVisible();
    await expect(page.getByText('Attestations de réussite (PDF)')).toBeVisible();
    await expect(page.getByText('Liste des participants')).toBeVisible();
  });

  test('un document officiel n’est pas accessible sans être connecté', async ({ page }) => {
    const sessionId = 'peu-importe';
    await page.goto(`/print/sessions/${sessionId}/minutes`);
    await expect(page).toHaveURL(/\/login/);
  });
});
