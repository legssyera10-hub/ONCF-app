# Documentation Technique

Ce document decrit les livrables documentaires existants et leur usage.

## Convention de roles

La plateforme expose 4 roles metier:

1. `Technicentre` (demandeur / recepteur).
2. `Permanent PM`.
3. `Admin`.
4. `Suivi`.

Note: certaines sections techniques historiques peuvent encore conserver des termes anciens pour des raisons de compatibilite de code.

## Livrables

- `DOC_PROJET.md`: description technique detaillee du backend, frontend, API et workflow.
- `MAP_FICHIERS.md`: table de cartographie des fichiers et responsabilites.
- `assets/processus_acheminement_materiel_roulant.png`: schema du processus metier.

## Sources de verite a privilegier

- Flux metier et demarrage: `README.md` et `QUICKSTART.md`.
- Comportement reel: code source sous `backend/` et `frontend/`.
- Comptes de demo: `backend/app/seed.py`.

## Scripts de generation documentaire

Les scripts historiques sont conserves sous `scripts/docs/`:

- `scripts/docs/generate_documentation.py`
- `scripts/docs/generate_pdf_with_diagrams.py`

Ils peuvent etre ajustes si vous souhaitez regenerer des livrables PDF/HTML.
