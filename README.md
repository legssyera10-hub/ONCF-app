# ONCF - Gestion d'acheminement et d'essais en ligne du materiel roulant

Plateforme full-stack pour gerer les demandes d'acheminement, les decisions PM, la confirmation de reception et le nouveau module de demandes d'essais en ligne.

## Etat actuel (Mai 2026)

- Authentification JWT et controle d'acces par role.
- Workflow de bout en bout: creation, traitement PM, reception, suivi.
- Module separe "Essais en ligne": creation, analyse PM, suivi aller/retour, retard par materiel.
- Historique de statut par dossier.
- Notifications temps reel via WebSocket (`/ws/alerts`).
- Administration des comptes et export.

## Roles metier (plateforme)

La plateforme est organisee autour de 5 roles metier:

1. `Technicentre` (demandeur / recepteur).
2. `Projet` (demandeur essais en ligne).
3. `Permanent PM`.
4. `Admin`.
5. `Suivi`.

Note de compatibilite: quelques alias techniques historiques restent dans le code, mais la navigation metier officielle se fait via `/technicentre/*`.

## Stack technique

- Backend: FastAPI, SQLAlchemy 2, Alembic, JWT, WebSocket.
- Frontend: React, Vite, TypeScript, TailwindCSS.
- Base de donnees: SQLite en local, PostgreSQL via Docker Compose.

## Structure du projet

```text
backend/        API, modele de donnees, services metier, seed
frontend/       Interface utilisateur React
docs/           Documentation fonctionnelle et technique
scripts/docs/   Scripts de generation documentaire
```

## Demarrage rapide

Guide detaille: [docs/QUICKSTART.md](docs/QUICKSTART.md)

Resume:

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

```powershell
# Frontend
cd frontend
copy .env.example .env
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Comptes de demonstration

- `admin / pass123`
- `permanent / pass123`
- `suivi / pass123`
- `projet / pass123`
- `tmic / pass123`
- `tmrc / pass123`
- `tmlc / pass123`

Les comptes technicentres sont generes depuis le seed backend (`backend/app/seed.py`).

## Docker Compose

```powershell
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

## API principale

- `POST /auth/login`
- `GET /me`
- `POST /alerts`
- `GET /alerts`
- `POST /alerts/{id}/decision`
- `POST /alerts/{id}/confirm`
- `POST /online-trials`
- `GET /online-trials`
- `POST /online-trials/{id}/decision`
- `POST /online-trials/{id}/progress`
- `GET /notifications`
- `GET /stations`
- `GET /establishments`

## Documentation complementaire

- [Documentation d'ensemble](docs/README.md)
- [Cartographie fichiers](docs/MAP_FICHIERS.md)
- [Documentation projet detaillee](docs/DOC_PROJET.md)
- [Documentation technique PDF/HTML](docs/README_DOCUMENTATION.md)
