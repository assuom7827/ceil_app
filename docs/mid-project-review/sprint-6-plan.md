# Sprint 6 — i18n, confirmations et prévisualisation PDF

**Objectif** : compléter l'internationalisation, ajouter des dialogues de confirmation systématiques et implémenter la prévisualisation PDF avant génération.

**Durée estimée** : 1 semaine.

**Équipe suggérée** : 1 dev front-end + 1 reviewer.

**Definition of Done** :
- Toutes les chaînes de caractères de l'application sont externalisées en français et en anglais.
- Toutes les actions critiques (suppression, envoi, modification d'état) déclenchent un dialogue de confirmation.
- Les documents (attestations, certificats, exports) peuvent être prévisualisés en PDF avant téléchargement.
- Les tests E2E passent.

---

## Tâches du sprint

| ID | Titre | Type | Priorité | Complexité |
|---|---|---|---|---|
| S6-01 | Finaliser l'i18n (FR/EN) | Feature | P0 | M |
| S6-02 | Ajouter des dialogues de confirmation systématiques | Feature | P0 | M |
| S6-03 | Implémenter la prévisualisation PDF | Feature | P0 | M |
| S6-04 | Externaliser les messages d'erreur et de succès | Feature | P1 | S |
| S6-05 | Tests E2E i18n et confirmations | Testing | P1 | S |

---

## Détail des tâches

### S6-01 — Finaliser l'i18n (FR/EN)

**Solution**
1. Auditer l'application pour identifier les chaînes non traduites :
   - Pages, composants, emails, notifications, erreurs serveur.
2. Compléter les fichiers de traduction (`messages/fr.json`, `messages/en.json`).
3. Ajouter un sélecteur de langue dans le header (persister dans `localStorage` ou cookie).
4. S'assurer que la langue par défaut est `fr` et que la détection automatique fonctionne (`Accept-Language`).
5. Vérifier que les dates, nombres et devises sont formatés selon la locale (`Intl`).

**Fichiers à modifier / créer**
- `messages/fr.json`, `messages/en.json`
- `src/components/LanguageSwitcher.tsx` (nouveau)
- `src/middleware.ts` (détection de locale)
- Composants avec chaînes hardcodées

**Tests**
- Tests E2E : basculer la langue → interface en anglais.
- Tests E2E : dates formatées correctement selon la locale.

**Estimation** : 2 jours.

---

### S6-02 — Ajouter des dialogues de confirmation systématiques

**Solution**
1. Créer un composant réutilisable `ConfirmDialog` :
   ```tsx
   <ConfirmDialog
     open={open}
     title={t('common.confirmDelete')}
     description={t('common.confirmDeleteDescription', { name })}
     confirmLabel={t('common.delete')}
     cancelLabel={t('common.cancel')}
     onConfirm={handleDelete}
     variant="danger"
   />
   ```
2. Identifier toutes les actions critiques et ajouter le dialogue :
   - Suppression de session, participant, inscription, groupe, site, salle.
   - Verrouillage / déverrouillage de session.
   - Remboursement de paiement.
   - Suppression de justificatif.
3. Ajouter un state manager pour les confirmations (ex: `useConfirm` hook) si nécessaire pour éviter la prop drilling.

**Fichiers à modifier / créer**
- `src/components/ConfirmDialog.tsx` (nouveau)
- `src/hooks/useConfirm.ts` (nouveau)
- Pages et composants concernés

**Tests**
- Tests E2E : cliquer sur supprimer → dialogue apparaît.
- Tests E2E : confirmer → action exécutée. Annuler → rien ne se passe.

**Estimation** : 2 jours.

---

### S6-03 — Implémenter la prévisualisation PDF

**Solution**
1. Créer un endpoint `POST /api/documents/preview` :
   - Accepte les mêmes paramètres que les endpoints de génération (`/attestation`, `/certificates`).
   - Retourne le PDF en base64 ou en flux HTTP avec `Content-Disposition: inline`.
2. Dans l'UI :
   - Ajouter un bouton **« Aperçu »** à côté de **« Télécharger »**.
   - Ouvrir le PDF dans un nouvel onglet ou une modale avec `<iframe>` ou `<embed>`.
3. Gérer les erreurs : si la génération échoue, afficher un message d'erreur clair.

**Fichiers à modifier / créer**
- `src/app/api/documents/preview/route.ts` (nouveau)
- Composants de prévisualisation (modale ou iframe)

**Tests**
- Tests d'intégration : endpoint retourne un PDF valide.
- Tests E2E : cliquer sur aperçu → PDF affiché.

**Estimation** : 1 jour.

---

### S6-04 — Externaliser les messages d'erreur et de succès

**Solution**
1. Auditer les messages hardcodés dans :
   - `src/services/*.ts` (erreurs métier)
   - `src/app/api/**/*.ts` (messages d'API)
   - Composants UI (toasts, alertes)
2. Déplacer chaque message dans `messages/fr.json` et `messages/en.json`.
3. Utiliser des clés explicites : `errors.enrollment.notFound`, `success.payment.recorded`.
4. Pour les erreurs serveur dynamiques (avec variables), utiliser les fonctions de formatage i18n :
   ```ts
   t('errors.enrollment.notFound', { enrollmentId })
   ```

**Fichiers à modifier**
- `messages/fr.json`, `messages/en.json`
- `src/services/*.ts`
- `src/components/*.tsx`

**Tests**
- Tests unitaires : vérifier que les clés i18n existent.
- Tests E2E : messages d'erreur en français et en anglais.

**Estimation** : 1 jour.

---

### S6-05 — Tests E2E i18n et confirmations

**Objectif**
Vérifier que l'i18n est complète et que les dialogues de confirmation fonctionnent.

**Scénarios**

| Scénario | Description | Résultat attendu |
|---|---|---|
| `i18n-switch.spec.ts` | Basculer FR → EN → FR | Interface traduite, dates formatées |
| `i18n-completeness.spec.ts` | Vérifier qu'aucune clé i18n n'est manquante | Aucun message hardcodé |
| `confirmations.spec.ts` | Supprimer une session → confirmer → supprimé | Dialogue + action exécutée |
| `confirmations-cancel.spec.ts` | Supprimer une session → annuler → non supprimé | Dialogue + action annulée |
| `pdf-preview.spec.ts` | Générer une attestation → aperçu PDF | PDF affiché dans la modale |

**Fichiers à créer / modifier**
- `e2e/i18n-switch.spec.ts` (nouveau)
- `e2e/confirmations.spec.ts` (nouveau)
- `e2e/pdf-preview.spec.ts` (nouveau)

**Estimation** : 1 jour.

---

## Ordre de traitement recommandé

```
Jour 1 : S6-01 (i18n) — début
Jour 2 : S6-01 (i18n) — suite + S6-04 (messages d'erreur)
Jour 3 : S6-02 (confirmations) — début
Jour 4 : S6-02 (confirmations) — suite
Jour 5 : S6-03 (prévisualisation PDF)
Jour 6 : S6-05 (tests E2E) — début
Jour 7 : S6-05 (suite) + revue + merge
```

## Risques du sprint

| Risque | Mitigation |
|---|---|
| Oublis de chaînes non traduites | Linter i18n (ex: `i18next-parser`) pour détecter les clés manquantes. |
| Performance de la prévisualisation PDF | Générer le PDF de manière asynchrone, afficher un loader. |
| Fatigue des utilisateurs avec trop de confirmations | Confirmer seulement les actions irréversibles (suppression, envoi). |

## Livrables

1. `messages/fr.json` et `messages/en.json` complets.
2. `src/components/ConfirmDialog.tsx` (nouveau composant).
3. `src/app/api/documents/preview/route.ts` (nouveau).
4. UI : sélecteur de langue, dialogues de confirmation, prévisualisation PDF.
5. Tests E2E i18n, confirmations et prévisualisation.
