import { expect, test, type Page } from '@playwright/test';

/**
 * Saisie au clavier, caractère par caractère, sur une grille de taille réaliste.
 *
 * Deux raisons d'exister, toutes deux issues d'un défaut réel signalé en usage :
 *
 *   1. `fill()` pose la valeur en une fois — il ne peut pas révéler des
 *      caractères perdus entre deux touches. Seul `pressSequentially()`
 *      reproduit une vraie frappe.
 *   2. Une grille de cinq lignes ne révèle pas un coût de rendu qui devient
 *      sensible à plusieurs dizaines. La session est donc montée pour l'occasion
 *      avec assez d'inscrits pour que le problème apparaisse.
 */
const ROWS = 60;
const RUN = Date.now().toString().slice(-6);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('manager@ceil.local');
  await page.getByLabel('Mot de passe').fill('Ceil@Manager2025!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/');
}

/** Crée une session peuplée via l'API, bien plus rapide que par l'écran. */
async function createBusySession(page: Page): Promise<string> {
  const trainings = (await (await page.request.get('/api/trainings?q=Anglais')).json()) as {
    data: Array<{ id: string }>;
  };
  const trainingId = trainings.data[0]!.id;

  const session = (await (
    await page.request.post('/api/sessions', {
      data: {
        trainingId,
        academicYear: '2025-2026',
        admissionThreshold: 50,
        matriculePrefix: `SAISIE-${RUN}`,
      },
    })
  ).json()) as { id: string };

  await page.request.post(`/api/sessions/${session.id}/enroll`, {
    data: {
      participantIds: [],
      newParticipants: Array.from({ length: ROWS }, (_, index) => ({
        familyName: `SAISIE${RUN}${String(index).padStart(3, '0')}`,
        firstName: 'Test',
      })),
    },
  });

  return session.id;
}

test.describe.configure({ mode: 'serial' });

let sessionId = '';

test.describe(`grille de délibération à ${ROWS} lignes`, () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    if (!sessionId) sessionId = await createBusySession(page);
    await page.goto(`/sessions/${sessionId}/workspace`);
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('« 10 » se saisit d’une traite, sans reclic', async ({ page }) => {
    const cell = page.getByRole('row').nth(1).getByLabel('E.E');
    await cell.click();
    await cell.pressSequentially('10', { delay: 60 });

    await expect(cell).toHaveValue('10');
    await expect(cell).toBeFocused();
  });

  /** Cas le plus dur : aucun délai entre les touches. */
  test('une frappe rapide ne perd aucun caractère', async ({ page }) => {
    const cell = page.getByRole('row').nth(2).getByLabel('C.O');
    await cell.click();
    await cell.pressSequentially('12345', { delay: 0 });

    await expect(cell).toHaveValue('12345');
    await expect(cell).toBeFocused();
  });

  test('la colonne calculée rattrape la saisie', async ({ page }) => {
    const row = page.getByRole('row').nth(3);

    await row.getByLabel('E.O').click();
    await row.getByLabel('E.O').pressSequentially('30', { delay: 0 });
    await row.getByLabel('C.E').click();
    await row.getByLabel('C.E').pressSequentially('25', { delay: 0 });

    // Total et statut sont différés, mais doivent finir par concorder.
    await expect(row).toContainText('55');
    await expect(row).toContainText('Admis');
  });

  test('la valeur saisie survit à l’enregistrement puis au rechargement', async ({ page }) => {
    const row = page.getByRole('row').nth(4);
    const cell = row.getByLabel('E.E');
    await cell.click();
    await cell.pressSequentially('17,5', { delay: 0 });
    await expect(cell).toHaveValue('17,5');

    await page.getByRole('button', { name: /Enregistrer tout/ }).click();
    await expect(page.getByTestId('feedback-success')).toBeVisible();

    await page.reload();
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    await expect(page.getByRole('row').nth(4).getByLabel('E.E')).toHaveValue('17.5');
  });

  test('le collage depuis Excel remplit la cellule d’origine et ses voisines', async ({ page }) => {
    const cell = page.getByRole('row').nth(5).getByLabel('E.O');
    await cell.click();

    // Deux colonnes, deux lignes — comme une sélection copiée d'un tableur.
    await page.evaluate(() => {
      const target = document.activeElement as HTMLInputElement | null;
      if (!target) return;
      const data = new DataTransfer();
      data.setData('text/plain', '11\t12\n13\t14');
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });

    await expect(cell).toHaveValue('11');
    await expect(page.getByRole('row').nth(5).getByLabel('E.E')).toHaveValue('12');
    await expect(page.getByRole('row').nth(6).getByLabel('E.O')).toHaveValue('13');
  });
});
