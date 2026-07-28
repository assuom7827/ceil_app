import { expect, test, type Page } from '@playwright/test';

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
  await page.getByLabel('Mot de passe').fill(MANAGER.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/');
}

async function openWorkspace(page: Page) {
  await page.goto('/sessions');
  await page.getByRole('link', { name: 'Espace de travail' }).first().click();
  await expect(page.getByRole('tab', { name: 'Inscrits' })).toBeVisible();
}

/** Nom unique par exécution : les tests partagent la base de développement. */
function uniqueName(prefix: string) {
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

test.describe('espace de travail de session', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openWorkspace(page);
  });

  test('affiche le titre dérivé et les cinq onglets', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Anglais');
    for (const tab of [
      'Inscrits',
      'Positionnement',
      'Notes / Délibération',
      'Groupes',
      'Documents',
    ]) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    await expect(page.getByTestId('session-state')).toHaveText('Ouverte');
  });

  test('inscrit un participant créé à la volée, en une seule étape', async ({ page }) => {
    const name = uniqueName('BENALI');

    await page.getByRole('button', { name: 'Inscrire des participants' }).click();
    await page.getByRole('button', { name: 'Ajouter une ligne' }).click();
    await page.getByLabel('Nom', { exact: true }).fill(name);
    await page.getByLabel('Prénom', { exact: true }).fill('Amina');
    await page.getByRole('button', { name: /^Inscrire \(1\)$/ }).click();

    // Le dialogue se ferme et la grille se rafraîchit toute seule.
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('cell', { name: new RegExp(name) })).toBeVisible();
  });

  test('calcule total et statut en direct dans la grille de délibération', async ({ page }) => {
    const name = uniqueName('NOTES');

    await page.getByRole('button', { name: 'Inscrire des participants' }).click();
    await page.getByRole('button', { name: 'Ajouter une ligne' }).click();
    await page.getByLabel('Nom', { exact: true }).fill(name);
    await page.getByRole('button', { name: /^Inscrire \(1\)$/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();

    // Sous le seuil de 50 : ajourné.
    await row.getByLabel('E.O').fill('10');
    await row.getByLabel('E.E').fill('10');
    await expect(row).toContainText('20');
    await expect(row).toContainText('Ajourné');

    // Au-dessus : admis — sans aucun aller-retour serveur.
    await row.getByLabel('C.O').fill('20');
    await row.getByLabel('C.E').fill('20');
    await expect(row).toContainText('60');
    await expect(row).toContainText('Admis');

    await page.getByRole('button', { name: /Enregistrer tout/ }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('enregistrée');

    // Après rechargement, le statut vient du serveur : il doit concorder.
    await page.reload();
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Admis');
  });

  test('recalcule l’admission selon le seuil de la session', async ({ page }) => {
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    await page.getByRole('button', { name: 'Recalculer les résultats' }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('admis');
  });

  test('verrouille la session et fige les grilles', async ({ page }) => {
    await page.getByRole('button', { name: 'Verrouiller' }).click();
    await expect(page.getByTestId('session-state')).toHaveText('Verrouillée');
    await expect(page.getByText('les grilles sont en lecture seule')).toBeVisible();

    // Les actions d'écriture disparaissent ou se désactivent.
    await expect(page.getByRole('button', { name: 'Inscrire des participants' })).toBeDisabled();

    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    await expect(page.getByRole('button', { name: /Enregistrer tout/ })).toBeDisabled();

    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByTestId('session-state')).toHaveText('Ouverte');
  });

  test('organise les groupes par niveau depuis l’onglet Groupes', async ({ page }) => {
    await page.getByRole('tab', { name: 'Groupes' }).click();
    await expect(
      page.getByRole('heading', { name: /Groupes de session, par niveau/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir les groupes' }).click();
    await expect(page.getByTestId('feedback-success')).toBeVisible();
  });
});
