import { expect, test } from '@playwright/test';

test.describe('scaffold', () => {
  test('la sonde de santé répond', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
  });

  test("la page d'accueil s'affiche en français", async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
