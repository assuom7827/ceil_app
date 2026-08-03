# Mid-Project Review — CEIL

## Présentation

Ce dossier contient l'audit de mi-parcours de l'application de gestion du **Centre d'Enseignement Intensif des Langues (CEIL)** — Université Abdelhamid Ibn Badis, Mostaganem.

L'objectif de cette review est de :

* dresser un état des lieux complet du code, de l'architecture et des fonctionnalités ;
* identifier les manques, incohérences et risques ;
* produire une nouvelle baseline fonctionnelle et technique ;
* proposer une roadmap et un backlog priorisés pour la deuxième moitié du développement.

**Aucun fichier de code n'a été modifié pendant cette phase.**

## Fichiers de l'audit

| Fichier | Contenu |
|---------|---------|
| [`executive-summary.md`](./executive-summary.md) | Synthèse générale et verdict production |
| [`functional-gap-analysis.md`](./functional-gap-analysis.md) | Matrice de gaps fonctionnels par domaine |
| [`business-rules.md`](./business-rules.md) | Catalogue des règles métier |
| [`functional-requirements.md`](./functional-requirements.md) | Exigences fonctionnelles proposées |
| [`non-functional-requirements.md`](./non-functional-requirements.md) | Exigences non fonctionnelles (NFR) |
| [`ux-review.md`](./ux-review.md) | Audit UX/UI |
| [`security-review.md`](./security-review.md) | Audit sécurité |
| [`architecture-review.md`](./architecture-review.md) | Audit de l'architecture et modèle de données |
| [`testing-review.md`](./testing-review.md) | Audit des tests |
| [`production-readiness.md`](./production-readiness.md) | Évaluation de la production readiness |
| [`proposed-features.md`](./proposed-features.md) | Fonctionnalités proposées classées par priorité |
| [`roadmap.md`](./roadmap.md) | Roadmap de finalisation |
| [`prioritized-backlog.md`](./prioritized-backlog.md) | Backlog priorisé |

## Questions clés traitées

À la fin de chaque rapport, les 12 questions de la commande initiale sont explicitement traitées dans [`executive-summary.md`](./executive-summary.md) (section *Conclusion attendue*).

## Méthodologie

1. **Lecture statique exhaustive** du repository (`README`, documentation, schéma Prisma, migrations, source `src/`, tests).
2. **Analyse parallèle par sous-agent** des couches services/lib, du modèle de données, du frontend/UX et des routes API.
3. **Recoupement** des constats, distinction entre problèmes confirmés, probables et recommandations.
4. **Aucune exécution de code, aucune migration, aucune implémentation**.

## Hypothèses importantes

* Le présent audit se base sur le code tel qu'il se trouve dans le repository, complété par les indications du `README` et de `docs/etat-du-projet.md`.
* Les chiffres de tests du `README` (300 Vitest, 51 Playwright) **n'ont pas été vérifiés en exécutant les suites** ; ils sont cités tels quels.
* Les questions ouvertes listées dans `docs/etat-du-projet.md` restent des hypothèses métier non confirmées par le CEIL.

---

*Dernière mise à jour : 2026-08-02.*
