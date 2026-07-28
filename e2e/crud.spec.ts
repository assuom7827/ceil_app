import { expect, test, type Page } from '@playwright/test';

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };
const USER = { email: 'user@ceil.local', password: 'Ceil@User2025!' };

async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/');
}

function unique(prefix: string) {
  return `${prefix} ${Date.now().toString().slice(-6)}`;
}

test.describe('CRUD des référentiels', () => {
  test('crée, modifie et supprime une faculté', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto('/references');

    const name = unique('Faculté test');
    // Les sélecteurs sont restreints au dialogue : « Nom » est une sous-chaîne
    // d'intitulés de la page, par exemple « Sciences Éco-nom-iques ».
    const dialog = page.getByRole('dialog');

    await page.getByRole('button', { name: 'Nouveau' }).click();
    await dialog.getByLabel('Nom').fill(name);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();

    // Modification
    const renamed = `${name} bis`;
    await page.getByRole('button', { name: `Modifier ${name}` }).click();
    await dialog.getByLabel('Nom').fill(renamed);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('cell', { name: renamed, exact: true })).toBeVisible();

    // Suppression, avec confirmation
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Supprimer ${renamed}` }).click();
    await expect(page.getByRole('cell', { name: renamed, exact: true })).toBeHidden();
  });

  test('affiche l’erreur de validation renvoyée par le serveur', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto('/references');
    await page.getByRole('tab', { name: 'Niveaux CECRL' }).click();

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Nouveau' }).click();
    await dialog.getByLabel('Nom').fill(unique('X'));
    await dialog.getByLabel('Ordre').fill('99');
    await dialog.getByLabel('Minimum (inclus)').fill('50');
    // Intervalle vide : le maximum doit être STRICTEMENT supérieur au minimum.
    await dialog.getByLabel('Maximum (exclu)').fill('50');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(
      page.getByText('Le maximum doit être strictement supérieur au minimum'),
    ).toBeVisible();
  });

  test('modifie les niveaux d’une formation via l’éditeur M2N', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto('/trainings');

    await page.getByRole('button', { name: /^Modifier Anglais$/ }).click();
    await expect(page.getByText('Niveaux proposés')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('B1.1')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
  });

  test('cherche un participant par matricule', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto('/participants');
    await page.getByLabel(/Nom, prénom, matricule/).fill('PART-ETU');
    await expect(page.getByRole('cell', { name: /PART-ETU-/ }).first()).toBeVisible();
  });
});

test.describe('visibilité selon le rôle', () => {
  test('USER ne peut pas écrire sur les formations ni les paiements', async ({ page }) => {
    await login(page, USER);

    await page.goto('/trainings');
    await expect(page.getByText('Lecture seule pour votre rôle.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau' })).toBeHidden();

    await page.goto('/payments');
    await expect(page.getByText('Lecture seule pour votre rôle.')).toBeVisible();
  });

  test('USER conserve l’écriture sur les participants', async ({ page }) => {
    await login(page, USER);
    await page.goto('/participants');
    await expect(page.getByRole('button', { name: 'Nouveau' })).toBeVisible();
  });

  test('l’administration des comptes reste invisible hors ADMIN', async ({ page }) => {
    await login(page, MANAGER);
    await expect(page.getByRole('link', { name: 'Paramètres' })).toBeHidden();
  });
});
