# MAP_FICHIERS

> Note de mise a jour (Mai 2026): la lecture metier se fait selon 4 roles (`Technicentre`, `Permanent PM`, `Admin`, `Suivi`). Certaines references `AGENT`/`ETABLISSEMENT` sont conservees pour compatibilite technique.

Table de cartographie: chemin -> responsabilité -> dépendances -> points d'attention.

## Racine

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| README.md | Documentation générale projet | backend, frontend, docker-compose | Quelques comptes de démo diffèrent du seed actuel |
| .env.example | Variables d'env backend local | backend/app/core/config.py | Sert de base pour backend/.env |
| docker-compose.yml | Orchestration Postgres + backend + frontend | backend/Dockerfile, frontend/Dockerfile | DB Postgres active en compose, pas SQLite |
| oncf_demo.db | Base SQLite de demo (racine) | SQLAlchemy/Alembic local | Il existe aussi backend/oncf_demo.db dans l'arborescence |
| uploads/ | Uploads exposés statiquement | backend/app/main.py | Peut contenir données sensibles de pièces jointes |

## Backend - Entrée / config / DB

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| backend/app/main.py | Entrée FastAPI, CORS, routers, WS, static /uploads | config, db.session, db.bootstrap, seed, api/*, services.realtime | Startup exécute create_all + migrations SQL + seed |
| backend/app/core/config.py | Settings Pydantic depuis .env | pydantic-settings | parsed_cors_origins dépend d'un CSV bien formé |
| backend/app/core/security.py | Hash/verify mot de passe + création JWT | passlib, jose, settings | JWT secret par défaut non sécurisé |
| backend/app/core/technicentres.py | Codes technicentres autorisés | utilisé par api/meta.py, api/admin.py, seed.py | Filtre les établissements exposés en API |
| backend/app/db/session.py | Engine/session SQLAlchemy + get_db | settings.database_url | connect_args SQLite spécifique |
| backend/app/db/base.py | Declarative Base | sqlalchemy.orm | Base commune pour metadata |
| backend/app/db/bootstrap.py | Migration impérative au startup (CREATE/ALTER/updates) | engine, settings | Coexiste avec Alembic; risque divergence schéma |
| backend/alembic/env.py | Configuration Alembic runtime | settings, Base.metadata, app.models | URL SQLAlchemy injectée depuis settings |
| backend/alembic/versions/20260310_0001_initial.py | Schéma initial | alembic op, sqlalchemy | Enums initiaux diffèrent du domaine actuel |
| backend/alembic/versions/20260410_0002_add_requested_destination_to_alerts.py | Ajout destination demandée | alembic | Chaîne 0001 -> 0002 |
| backend/alembic/versions/20260410_0003_add_transport_mode_to_alerts.py | Ajout mode d'acheminement | alembic | Update valeur par défaut FRET |
| backend/alembic/versions/20260410_0004_add_transport_type_to_alerts.py | Ajout type d'acheminement | alembic | Update valeur par défaut HLP |
| backend/alembic/versions/20260412_0002_alert_mailing_and_fields.py | Ajouts request_date/speed/outlook/mail_events | alembic | down_revision parallèle à 0001 (branche potentielle) |

## Backend - API

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| backend/app/api/deps.py | Auth dépendance + contrôle rôles | jose, oauth2, settings, User, get_db | 401 sur token invalide, 403 sur rôle non autorisé |
| backend/app/api/auth.py | /auth/login et /me | security, deps, schemas.auth | Login sur username/password_hash |
| backend/app/api/meta.py | /stations et /establishments | deps.get_current_user, TECHNICENTRE_CODES | Retour établissements filtrés codes technicentres |
| backend/app/api/alerts.py | API workflow alertes/réceptions/notifications | models.alert, schemas.alert, services.alerts/mailing/storage/realtime | Fichier central métier; nombreux cas 400/403/404 |
| backend/app/api/admin.py | API admin comptes/établissements/export | schemas.admin, models.*, openpyxl | Suppression compte interdite si historique |

## Backend - Modèles et schémas

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| backend/app/models/enums.py | Enums métiers (rôles/statuts/niveaux) | enum.Enum | Inclut rôle SUIVI |
| backend/app/models/user.py | Modèle utilisateur | Base, UserRole, Establishment FK | outlook_email nullable |
| backend/app/models/station.py | Modèle gare | Base | lat/lon optionnels |
| backend/app/models/establishment.py | Modèle établissement | Base | outlook_email/lat/lon optionnels |
| backend/app/models/alert.py | Modèles alertes + relations annexes | enums, Base, SQLAlchemy relations | Cœur de toutes relations métier |
| backend/app/schemas/auth.py | DTO auth | pydantic | from_attributes activé |
| backend/app/schemas/common.py | DTO station/establishment | pydantic | Utilisé dans plusieurs DTOs |
| backend/app/schemas/alert.py | DTO complet alertes et actions | pydantic, enums | decision autorise CONFIRMER/ANNULER/MODIFIER |
| backend/app/schemas/notification.py | DTO notifications | schemas.alert/common | Notification embarque AlertRead complet |
| backend/app/schemas/admin.py | DTO admin users/establishments/history | pydantic, enums | Validation min/max champs |

## Backend - Services et seed

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| backend/app/services/realtime.py | Gestion connexions websocket + broadcast JSON | fastapi.WebSocket, json | Channel unique utilisé: alerts |
| backend/app/services/storage.py | Persist pièces jointes en local | pathlib, UploadFile, settings.upload_dir | Nommage UUID; stockage filesystem local |
| backend/app/services/mailing.py | Composition + envoi SMTP + log MailEvent | email/smtplib, settings, models.alert | Gère états SENT/FAILED/CONFIGURATION_MANQUANTE |
| backend/app/services/alerts.py | Helpers métier alertes + accès + calcul retard | models.alert, HTTPException, SQLAlchemy | Contient un bloc SQLite destructif en fin de fichier |
| backend/app/seed.py | Seed idempotent des référentiels/comptes/alertes demo | SessionLocal, models.*, technicentres, add_history | Comptes seed différents de certains exemples README |

## Frontend - Entrée / routage / client

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| frontend/src/main.tsx | Bootstrap React + providers + router | App, AuthProvider, AppNotificationsProvider | Inclut leaflet CSS globalement |
| frontend/src/App.tsx | Déclaration routes + guard RequireAuth | react-router-dom, lazyRoutes, useAuth, AppShell | Redirections différentes selon rôle |
| frontend/src/routes/lazyRoutes.ts | Lazy imports + preloading navigation | dynamic import pages | Optimisation chargement par préfixe route |
| frontend/src/api/client.ts | Client HTTP unifié | API_BASE_URL, types | 401 purge localStorage token/user |
| frontend/src/utils/api.ts | Source URL API | VITE_API_URL | Défaut http://localhost:8000 |
| frontend/src/contexts/AuthContext.tsx | Gestion session front | api.login/api.me, localStorage | ready=true même après logout |
| frontend/src/contexts/AppNotificationsContext.tsx | Toasts live selon rôle/type évènement | useLiveAlerts, useAuth | Filtrage rôles par event type |
| frontend/src/hooks/useLiveAlerts.ts | WebSocket /ws/alerts | VITE_API_URL -> ws:// | onopen envoie "subscribe" |
| frontend/src/layouts/AppShell.tsx | UI shell + nav par rôle + preload | useAuth, preloadRoute | Route admin/technicentre/permanent/tracking distinctes |

## Frontend - Pages (rôle principal)

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| frontend/src/pages/LoginPage.tsx | Authentification | useAuth.login | Redirection selon rôle |
| frontend/src/pages/NewAlertPage.tsx | Création/édition demande | api.stations/establishments/alertById/createAlert/updateAlert | createAlert en FormData, update en JSON |
| frontend/src/pages/TechnicentreDemandPage.tsx | Liste demandes créées | api.alerts(mine=true), api.establishments | Filtres recherche/date |
| frontend/src/pages/TechnicentreModificationRequestsPage.tsx | Dossiers à modifier | api.alerts(status=A_MODIFIER) | Action corrective demandeur |
| frontend/src/pages/TechnicentreRequestHistoryPage.tsx | Historique demandes | api.alerts(mine=true), api.establishments | Détail via AgentAlertDetailPage |
| frontend/src/pages/TechnicentreReceptionListPage.tsx | Réceptions à traiter | api.notifications, api.establishments | Destiné AGENT/ETABLISSEMENT |
| frontend/src/pages/TechnicentreReceptionDetailPage.tsx | Confirmation réception / signalement problème | api.alertById, api.confirmReception, api.reportReceptionIssue | Gère partiel + issue mode |
| frontend/src/pages/TechnicentreReceptionHistoryPage.tsx | Historique réceptions | api.notifications, api.establishments | Détail en lecture |
| frontend/src/pages/TechnicentreHomePage.tsx | Dashboard technicentre | api.notifications, api.alerts(status=A_MODIFIER) | Vue synthèse |
| frontend/src/pages/AgentDashboard.tsx | Dashboard simplifié agent | api.alerts(mine=true) | Alias historique agent |
| frontend/src/pages/AgentAlertDetailPage.tsx | Détail dossier côté demandeur | api.alertById | Vue dossier |
| frontend/src/pages/PermanentDashboard.tsx | Backlog permanent + filtres | api.alerts, useLiveAlerts | Rafraîchissement live |
| frontend/src/pages/PermanentAlertDetailPage.tsx | Décision permanent + résolution issue | api.alertById, api.createDecision, api.resolveReceptionIssue | Form decision/reception issue |
| frontend/src/pages/PermanentMapPage.tsx | Carte permanent | api.stations, api.alerts, useLiveAlerts | Leaflet + signaux visuels |
| frontend/src/pages/AdminDashboard.tsx | Gestion comptes (liste + création) | api.adminUsers, api.establishments, api.createAdminUser | Filtrage rôles |
| frontend/src/pages/AdminUserDetailPage.tsx | Edition compte + export + suppression | api.adminUserDetail, api.updateAdminUser/password, api.exportAdminUser, api.deleteAdminUser | Flux export SUIVI en CSV côté front |
| frontend/src/pages/AdminAlertDetailPage.tsx | Détail alerte en contexte admin | api.alertById | Navigation retour vers user |
| frontend/src/pages/TrackingDashboardPage.tsx | Carte réseau SUIVI live | api.stations, api.alerts, useLiveAlerts | Signal sonore nouvelle alerte |
| frontend/src/pages/TrackingAllPage.tsx | Liste globale des transports en cours | api.alerts | Focus progress/délais |
| frontend/src/pages/TrackingPlaybackPage.tsx | Vue 2D des trajets | api.alerts, api.stations, TrainMap2D | Nécessite coordonnées + ETA |
| frontend/src/pages/EstablishmentProgressPage.tsx | Suivi progress établissement | api.alerts, api.confirmReception | Complément technicentre |
| frontend/src/pages/EstablishmentHistoryPage.tsx | Historique établissement | api.notifications | Complément technicentre |
| frontend/src/pages/EstablishmentDashboard.tsx | Dashboard établissement dédié | api.notifications, api.confirmReception | Route active INCONNUE dans App.tsx actuel |

## Frontend - Composants/utilitaires clés

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| frontend/src/components/DecisionForm.tsx | Saisie décision permanent | type PermanentDecisionAction | Force commentaire pour MODIFIER/ANNULER |
| frontend/src/components/ConfirmationForm.tsx | Saisie confirmation réception | utils/alertMaterials | Exige date + au moins 1 index matériel |
| frontend/src/components/ReceptionIssueResolutionForm.tsx | Résolution problème réception | action RELANCER/ANNULER | RELANCER exige date probable |
| frontend/src/components/AlertTimeline.tsx | Timeline statut | utils/status, utils/format | Tri/ordre fourni par backend |
| frontend/src/components/GeneratePdfButton.tsx | Export PDF côté client | utils/alertPdf | Vérifier rendu selon navigateur |
| frontend/src/components/TrainMap2D.tsx | Visualisation 2D trajet | tracking/playback pages | Dépend points géographiques |
| frontend/src/utils/status.ts | Labels/tons statuts métier | types.AlertStatus | Source unique libellés UI |
| frontend/src/utils/tracking.ts | Calcul progression/retards | dates alert/decision | Logique temps réel front |
| frontend/src/utils/railNetwork.ts | Résolution itinéraires 2D | stations | Qualité dépend référentiel gares |
| frontend/src/utils/alertMaterials.ts | Parsing multi-matériel/indexes | Alert.material_* | Utilisé pour réception partielle |
| frontend/src/utils/alertPdf.ts | Génération PDF | données Alert | Format business à valider métier |

## Config build/runtime

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| backend/Dockerfile | Image backend + run migrations/seed/api | requirements.txt, alembic, app.seed, uvicorn | Commande de démarrage chainée dans CMD |
| frontend/Dockerfile | Image frontend dev server | package.json, vite | Exécute npm run dev (pas build static nginx) |
| frontend/vite.config.ts | Config Vite/chunks | @vitejs/plugin-react | Segmentation vendor explicite |
| frontend/tailwind.config.js | Theme Tailwind | content src/index.html | Palette brand orange définie |
| frontend/postcss.config.js | Pipeline CSS | tailwindcss, autoprefixer | Standard |
| frontend/src/index.css | Design global + animations + classes utilitaires | Tailwind layers | Fichier de style central volumineux |
| backend/requirements.txt | Dépendances backend | pip | Versions figées |

## Fichiers d'environnement

| Chemin | Responsabilité | Dépendances directes | Points d'attention |
|---|---|---|---|
| backend/.env.example | Référence env backend | config.py, mailing.py | SMTP optionnel mais impacte MailEvent |
| frontend/.env.example | Référence env frontend | utils/api.ts | VITE_API_URL obligatoire hors localhost |
| backend/.env | Fichier runtime local | tous settings backend | Ne pas committer secrets |
| frontend/.env | Fichier runtime local | Vite import.meta.env | Ne pas committer secrets |
