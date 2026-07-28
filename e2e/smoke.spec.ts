import { expect, test } from '@playwright/test';

test.describe('scaffold', () => {
  test('la sonde de santé répond', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
  });

  test("l'application s'affiche en français par défaut", async ({ page }) => {
    // Non connecté, `/` redirige vers la connexion : c'est l'écran attendu.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
