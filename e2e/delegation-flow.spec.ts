import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };
const USER = { email: 'user@ceil.local', password: 'Ceil@User2025!' };

test.describe('délégation de sessions', () => {
  let sessionId = '';
  let userId = '';

  test.beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: USER.email },
      select: { id: true },
    });
    userId = user?.id ?? '';
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('MANAGER délègue une session à USER via l’API, USER accède puis perd l’accès', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
    await page.getByLabel('Mot de passe').fill(MANAGER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/sessions');
    await page.getByRole('button', { name: 'Nouvelle session' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Formation').selectOption({ label: 'Anglais' });
    await dialog.getByLabel('Année universitaire').fill('2026-2027');
    await dialog.getByLabel('Début').fill('2026-10-01');
    await dialog.getByLabel('Fin').fill('2027-06-30');
    await dialog.getByLabel('Seuil d’admission').fill('50');
    await dialog.getByLabel('Préfixe des matricules').fill('E2E-DEL');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await page.waitForURL(/\/sessions\/[^/]+\/workspace/);
    sessionId = page.url().split('/sessions/')[1]!.split('/')[0]!;

    const postResponse = await page.request.post(`/api/sessions/${sessionId}/agents`, {
      data: { userId },
    });
    expect(postResponse.ok()).toBe(true);

    const agentsResponse = await page.request.get(`/api/sessions/${sessionId}/agents`);
    expect(agentsResponse.ok()).toBe(true);
    const agents = await agentsResponse.json();
    expect(agents.some((a: { userId: string }) => a.userId === userId)).toBe(true);
  });

  test('USER peut accéder à la session déléguée et inscrire un participant', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(USER.email);
    await page.getByLabel('Mot de passe').fill(USER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');

    await page.goto(`/sessions/${sessionId}/workspace`);
    await expect(page.getByRole('tab', { name: 'Inscrits' })).toBeVisible();

    await page.getByRole('button', { name: 'Inscrire des participants' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Ajouter une ligne' }).click();
    await dialog.getByLabel('Nom', { exact: true }).last().fill('DELEGATE');
    await dialog.getByLabel('Prénom', { exact: true }).last().fill('Test');
    await dialog.getByRole('button', { name: /^Inscrire/ }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('cell', { name: 'DELEGATE Test' })).toBeVisible();
  });

  test('USER perd l’accès après le retrait de délégation', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
    await page.getByLabel('Mot de passe').fill(MANAGER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');

    await page.evaluate(
      async ({ sessionId, userId }) => {
        const response = await fetch(`/api/sessions/${sessionId}/agents`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        return response.status;
      },
      { sessionId, userId },
    );

    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(USER.email);
    await page.getByLabel('Mot de passe').fill(USER.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');

    await page.goto(`/sessions/${sessionId}/workspace`);
    const response = await page.request.get(`/api/sessions/${sessionId}/enrollments`);
    expect(response.status()).toBe(403);
  });
});
