# Frontend ONCF

Application React pour les parcours Technicentre, Projet, Permanent PM, Admin et Suivi.

## Stack

- React + TypeScript
- Vite
- TailwindCSS
- React Router

## Demarrage local

```powershell
npm install
copy .env.example .env
npm run dev
```

Application: `http://localhost:5173`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`

## Configuration

- `VITE_API_URL` (voir `frontend/.env.example`)

## Parcours principaux

- Acheminement: `/technicentre/*`, `/permanent/dashboard*`, `/tracking/requests*`
- Essais en ligne:
  - Createur Technicentre: `/essais/dashboard`, `/essais/new`, `/essais/history`, `/essais/:id`
  - Createur Projet: `/projet/essais/dashboard`, `/projet/essais/new`, `/projet/essais/history`, `/projet/essais/:id`
  - Permanent PM: `/permanent/essais`, `/permanent/essais/:id`
  - Suivi: `/tracking/essais`, `/tracking/essais/performance`
