import { expect, test, type Page } from '@playwright/test';

/**
 * Parcours métier complet, dans l'ordre réel d'utilisation :
 * création de session → inscription simplifiée → import de masse →
 * positionnement → attribution des niveaux → organisation des groupes →
 * saisie des notes → admission → diplôme.
 *
 * Les tests s'enchaînent en série sur UNE session créée pour l'occasion : c'est
 * la seule façon d'éprouver la continuité du cycle, qu'une suite de tests
 * indépendants ne vérifierait pas.
 */
test.describe.configure({ mode: 'serial' });

const MANAGER = { email: 'manager@ceil.local', password: 'Ceil@Manager2025!' };

/** Suffixe unique : la base de développement est partagée entre exécutions. */
const RUN = Date.now().toString().slice(-6);
const NAMES = [`ADMIS${RUN}`, `AJOURNE${RUN}`, `SANSNOTE${RUN}`];

let sessionId = '';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(MANAGER.email);
  await page.getByLabel('Mot de passe').fill(MANAGER.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL('/');
}

async function openWorkspace(page: Page) {
  await page.goto(`/sessions/${sessionId}/workspace`);
  await expect(page.getByRole('tab', { name: 'Inscrits' })).toBeVisible();
}

test.describe('parcours complet CEIL', () => {
  test('1. crée une session et ouvre son espace de travail', async ({ page }) => {
    await login(page);
    await page.goto('/sessions');

    await page.getByRole('button', { name: 'Nouvelle session' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Formation').selectOption({ label: 'Anglais' });
    await dialog.getByLabel('Année universitaire').fill('2025-2026');
    await dialog.getByLabel('Début').fill('2025-10-01');
    await dialog.getByLabel('Fin').fill('2026-06-30');
    await dialog.getByLabel('Seuil d’admission').fill('50');
    await dialog.getByLabel('Préfixe des matricules').fill(`E2E-${RUN}`);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // La création ouvre directement l'espace de travail.
    await page.waitForURL(/\/sessions\/[^/]+\/workspace/);
    sessionId = page.url().split('/sessions/')[1]!.split('/')[0]!;

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Anglais');
    await expect(page.getByTestId('session-state')).toHaveText('Ouverte');
  });

  test('2. inscrit trois participants créés à la volée, en une étape', async ({ page }) => {
    await login(page);
    await openWorkspace(page);

    await page.getByRole('button', { name: 'Inscrire des participants' }).click();
    const dialog = page.getByRole('dialog');

    for (const name of NAMES) {
      await dialog.getByRole('button', { name: 'Ajouter une ligne' }).click();
      await dialog.getByLabel('Nom', { exact: true }).last().fill(name);
    }

    await dialog.getByRole('button', { name: /^Inscrire \(3\)$/ }).click();
    await expect(dialog).toBeHidden();

    for (const name of NAMES) {
      await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
    }
    // Les matricules d'inscription suivent le préfixe de la session.
    await expect(page.getByRole('cell', { name: `E2E-${RUN}-0001` })).toBeVisible();
  });

  test('3. importe des inscrits depuis un fichier CSV', async ({ page }) => {
    await login(page);
    await openWorkspace(page);

    const csv = `Nom,Prenom,Telephone\nIMPORT${RUN},Karim,0550000001\n`;
    await page.locator('input[type="file"]').setInputFiles({
      name: 'inscrits.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    });

    // Le rapport d'import est affiché, pas seulement un message générique.
    await expect(page.getByText(/1 créé\(s\)/)).toBeVisible();
    // La cellule porte le nom complet dérivé (« NOM Prénom »), pas le seul nom.
    await expect(page.getByRole('cell', { name: new RegExp(`IMPORT${RUN} Karim`) })).toBeVisible();
  });

  test('4. saisit le positionnement et voit le niveau résolu en direct', async ({ page }) => {
    await login(page);
    await openWorkspace(page);
    await page.getByRole('tab', { name: 'Positionnement' }).click();

    const row = page.getByRole('row').filter({ hasText: NAMES[0]! });
    await expect(row).toBeVisible();

    // Barème du seed : 50 tombe dans B1.1 [50, 60[, pas dans A2.2 [40, 50[.
    await row.getByLabel('E.E').fill('25');
    await row.getByLabel('C.E').fill('25');
    await expect(row).toContainText('50');
    await expect(row).toContainText('B1.1');

    await page.getByRole('button', { name: /Enregistrer tout/ }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('enregistrée');
  });

  test('5. attribue les niveaux depuis les notes de positionnement', async ({ page }) => {
    await login(page);
    await openWorkspace(page);
    await page.getByRole('tab', { name: 'Positionnement' }).click();

    await page.getByRole('button', { name: 'Déterminer les niveaux' }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('niveau(x) attribué(s)');

    // Le niveau attribué rejoint le niveau résolu.
    const row = page.getByRole('row').filter({ hasText: NAMES[0]! });
    await expect(row).toContainText('B1.1');

    // Et il apparaît dans la grille des inscrits.
    await page.getByRole('tab', { name: 'Inscrits' }).click();
    await expect(page.getByRole('row').filter({ hasText: NAMES[0]! })).toBeVisible();
  });

  test('6. ouvre les groupes par niveau et répartit les inscrits', async ({ page }) => {
    await login(page);
    await openWorkspace(page);
    await page.getByRole('tab', { name: 'Groupes' }).click();

    await page.getByLabel('Places par groupe').fill('25');
    await page.getByRole('button', { name: 'Ouvrir les groupes' }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('B1.1');

    await page.getByRole('button', { name: 'Répartir les inscrits' }).click();
    // Seul le participant positionné a un niveau : les autres sont signalés.
    await expect(page.getByTestId('feedback-success')).toContainText('sans niveau attribué');
  });

  test('7. saisit les notes et voit l’admission se décider en direct', async ({ page }) => {
    await login(page);
    await openWorkspace(page);
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();

    const admitted = page.getByRole('row').filter({ hasText: NAMES[0]! });
    await admitted.getByLabel('E.O').fill('20');
    await admitted.getByLabel('E.E').fill('20');
    await admitted.getByLabel('C.O').fill('15');
    await admitted.getByLabel('C.E').fill('15');
    await expect(admitted).toContainText('70');
    await expect(admitted).toContainText('Admis');

    const refused = page.getByRole('row').filter({ hasText: NAMES[1]! });
    await refused.getByLabel('E.O').fill('10');
    await refused.getByLabel('E.E').fill('10');
    await expect(refused).toContainText('Ajourné');

    // Le troisième reste sans note : ni admis, ni ajourné.
    const pending = page.getByRole('row').filter({ hasText: NAMES[2]! });
    await expect(pending).toContainText('Non délibéré');

    await page.getByRole('button', { name: /Enregistrer tout/ }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('enregistrée');
  });

  test('8. recalcule l’admission selon le seuil de la session', async ({ page }) => {
    await login(page);
    await openWorkspace(page);
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();

    await page.getByRole('button', { name: 'Recalculer les résultats' }).click();
    await expect(page.getByTestId('feedback-success')).toContainText('1 admis');
    await expect(page.getByTestId('feedback-success')).toContainText('seuil 50');
  });

  test('9. imprime le diplôme du seul admis', async ({ page }) => {
    await login(page);
    await page.goto(`/print/sessions/${sessionId}/diplomas`);

    await expect(page.getByRole('heading', { name: 'شهادة نجاح' })).toBeVisible();
    // Le nom apparaît deux fois : le bloc arabe retombe sur le nom latin
    // lorsqu'aucun nom arabe n'est enregistré, plutôt que de rester vide.
    await expect(page.getByText(NAMES[0]!).first()).toBeVisible();
    await expect(page.getByText(NAMES[0]!)).toHaveCount(2);

    // L'ajourné ne doit PAS figurer parmi les diplômés.
    await expect(page.getByText(NAMES[1]!)).toHaveCount(0);

    // Mois de fin de session en arabe : juin → « جوان ».
    await expect(page.getByText(/جوان/).first()).toBeVisible();
  });

  test('10. le procès-verbal reprend les trois inscrits et leurs décisions', async ({ page }) => {
    await login(page);
    await page.goto(`/print/sessions/${sessionId}/minutes`);

    await expect(page.getByRole('row').filter({ hasText: NAMES[0]! })).toContainText('Admis');
    await expect(page.getByRole('row').filter({ hasText: NAMES[1]! })).toContainText('Ajourné');
    await expect(page.getByText(/1 admis, 1 ajourné/)).toBeVisible();
  });
});

test.describe('verrouillage de la session', () => {
  test.describe.configure({ mode: 'serial' });

  test('fige les grilles et refuse les écritures côté API', async ({ page }) => {
    await login(page);
    await openWorkspace(page);

    await page.getByRole('button', { name: 'Verrouiller' }).click();
    await expect(page.getByTestId('session-state')).toHaveText('Verrouillée');

    await expect(page.getByRole('button', { name: 'Inscrire des participants' })).toBeDisabled();
    await page.getByRole('tab', { name: 'Notes / Délibération' }).click();
    await expect(page.getByRole('button', { name: /Enregistrer tout/ })).toBeDisabled();

    // L'UI désactive les boutons ; le serveur, lui, REFUSE — une requête
    // forgée ne doit pas passer sous prétexte que le bouton était grisé.
    const response = await page.request.post(`/api/sessions/${sessionId}/enroll`, {
      data: { participantIds: [], newParticipants: [{ familyName: 'FORCE' }] },
    });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'LOCKED' });
  });

  test('laisse imprimer les documents malgré le verrouillage', async ({ page }) => {
    await login(page);
    // Verrouiller fige la saisie, pas la délivrance des documents officiels :
    // c'est même l'état normal au moment de les imprimer.
    await page.goto(`/print/sessions/${sessionId}/minutes`);
    await expect(page.getByText('Procès-verbal de délibération').first()).toBeVisible();
  });

  test('se déverrouille et rend la main', async ({ page }) => {
    await login(page);
    await openWorkspace(page);

    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByTestId('session-state')).toHaveText('Ouverte');
    await expect(page.getByRole('button', { name: 'Inscrire des participants' })).toBeEnabled();
  });
});
