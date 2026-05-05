# Backend ONCF

API FastAPI pour la gestion des demandes d'acheminement et des demandes d'essais en ligne.

## Stack

- FastAPI
- SQLAlchemy 2
- Alembic
- JWT (`python-jose`)
- WebSocket

## Demarrage local

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

API: `http://localhost:8000`

## Variables importantes

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `CORS_ORIGINS`
- `UPLOAD_DIR`
- Variables SMTP (optionnel)

Voir `backend/.env.example`.

## Notes roles

La plateforme prend en charge les roles metier:
`Technicentre`, `Projet`, `Permanent PM`, `Admin`, `Suivi`.

Le code conserve des constantes de compatibilite historiques.

## Endpoints module essais en ligne

- `POST /online-trials`
- `PUT /online-trials/{id}`
- `GET /online-trials`
- `GET /online-trials/{id}`
- `POST /online-trials/{id}/decision`
- `POST /online-trials/{id}/progress`
- `GET /online-trial-form-config`
