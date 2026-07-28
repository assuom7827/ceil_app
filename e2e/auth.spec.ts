import { expect, test } from '@playwright/test';

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };

test.describe('authentification', () => {
  test('redirige un visiteur non connecté vers la connexion', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('conserve la destination demandée', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login\?from=%2Fusers/);
  });

  test('refuse des identifiants incorrects sans révéler la cause', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // `getByRole('alert')` seul capterait aussi l'annonceur de route de Next.
    await expect(page.getByTestId('login-error')).toContainText('Identifiants incorrects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('connecte un responsable et affiche le tableau de bord', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
    await page.getByLabel('Mot de passe').fill(MANAGER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Responsable CEIL/ })).toBeVisible();
  });

  test('déconnecte et reverrouille l’accès', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
    await page.getByLabel('Mot de passe').fill(MANAGER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: /Responsable CEIL/ }).click();
    await page.getByRole('menuitem', { name: 'Déconnexion' }).click();

    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('bascule l’interface en arabe et passe en RTL', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
    await page.getByLabel('Mot de passe').fill(MANAGER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.getByRole('button', { name: /Responsable CEIL/ }).click();
    await page.getByRole('menuitem', { name: 'العربية' }).click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });
});
