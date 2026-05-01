# QUICKSTART

Objectif: lancer la plateforme en 5 a 15 minutes.

## Roles metier utilises

La plateforme fonctionne avec 4 roles:

1. `Technicentre` (demandeur / recepteur).
2. `Permanent PM`.
3. `Admin`.
4. `Suivi`.

## Option A - Local (sans Docker)

## 1) Prerequis

- Python 3.11+
- Node.js 22+
- npm

## 2) Demarrer le backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Backend: `http://localhost:8000`

Verification rapide:

```powershell
curl http://localhost:8000/health
```

Reponse attendue:

```json
{"status":"ok"}
```

## 3) Demarrer le frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## 4) Comptes de demo utiles

- `admin / pass123`
- `permanent / pass123`
- `suivi / pass123`
- `tmic / pass123`
- `tmrc / pass123`
- `tmlc / pass123`

## 5) Smoke test rapide

1. Se connecter en `tmic`.
2. Creer une demande via `/technicentre/demande/create`.
3. Se connecter en `permanent` dans une autre session.
4. Traiter la demande depuis `/permanent/dashboard`.
5. Se connecter avec le technicentre destinataire puis confirmer via `/technicentre/reception`.

## Option B - Docker Compose

## 1) Lancer

```powershell
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432`

## 2) Variables injectees par compose

- `DATABASE_URL=postgresql+psycopg://oncf:oncf@postgres:5432/oncf_demo`
- `JWT_SECRET_KEY=change-me-in-dev`
- `CORS_ORIGINS=http://localhost:5173,http://frontend:5173`

## Depannage express

- Erreur CORS: verifier `CORS_ORIGINS` et `frontend/.env`.
- Erreur DB: verifier l'URL SQLite en local ou Postgres en compose.
- 401 cote frontend: se reconnecter.
- Temps reel indisponible: verifier `/ws/alerts`.
- Mail non envoye: normal si SMTP non configure.
