import { expect, test, type Page } from '@playwright/test';

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
  await page.getByLabel('Mot de passe').fill(MANAGER.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/');
}

async function firstSessionId(page: Page): Promise<string> {
  await page.goto('/sessions');
  const href = await page.getByRole('link', { name: 'Espace de travail' }).first().getAttribute('href');
  const id = href?.split('/')[2];
  expect(id).toBeTruthy();
  return id as string;
}

test.describe('documents imprimables', () => {
  test('le procès-verbal affiche le tableau et le mois arabe', async ({ page }) => {
    await login(page);
    const sessionId = await firstSessionId(page);
    await page.goto(`/print/sessions/${sessionId}/minutes`);

    await expect(page.getByRole('heading', { name: 'محضر المداولة' })).toBeVisible();
    await expect(page.getByText('Procès-verbal de délibération').first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Décision' })).toBeVisible();

    // Le mois de fin de session (juin 2026) doit apparaître en arabe algérien.
    await expect(page.getByText(/جوان/).first()).toBeVisible();
  });

  test('les blocs arabes sont rendus en sens de lecture inversé', async ({ page }) => {
    await login(page);
    const sessionId = await firstSessionId(page);
    await page.goto(`/print/sessions/${sessionId}/minutes`);

    const rtl = page.locator('.rtl-block').first();
    await expect(rtl).toHaveCSS('direction', 'rtl');
  });

  test('la liste des participants prévoit une colonne d’émargement', async ({ page }) => {
    await login(page);
    const sessionId = await firstSessionId(page);
    await page.goto(`/print/sessions/${sessionId}/list`);

    await expect(page.getByRole('heading', { name: 'قائمة المشاركين' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Émargement' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'الاسم واللقب' })).toBeVisible();
  });

  test('les attestations sont accessibles depuis l’onglet Documents', async ({ page }) => {
    await login(page);
    const sessionId = await firstSessionId(page);
    await page.goto(`/sessions/${sessionId}/workspace`);
    await page.getByRole('tab', { name: 'Documents' }).click();

    await expect(page.getByText('Procès-verbal de délibération')).toBeVisible();
    await expect(page.getByText('Diplômes des admis')).toBeVisible();
    await expect(page.getByText('Liste des participants')).toBeVisible();
  });

  test('un document officiel n’est pas accessible sans être connecté', async ({ page }) => {
    const sessionId = 'peu-importe';
    await page.goto(`/print/sessions/${sessionId}/minutes`);
    await expect(page).toHaveURL(/\/login/);
  });
});
