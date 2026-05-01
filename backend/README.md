# Backend ONCF

API FastAPI pour la gestion des demandes d'acheminement et du workflow PM/reception.

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

La documentation metier utilise 4 roles: `Technicentre`, `Permanent PM`, `Admin`, `Suivi`.
Le code conserve des constantes de roles historiques pour compatibilite.
