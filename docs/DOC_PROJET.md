# DOC_PROJET

> Note de mise a jour (Mai 2026): la plateforme est presentee avec 4 roles metier (`Technicentre`, `Permanent PM`, `Admin`, `Suivi`). Les mentions `AGENT`/`ETABLISSEMENT` dans ce document correspondent a des termes techniques historiques encore presents dans le code.

## 1) Périmètre et validation du contexte

Projet validé dans le dépôt: ONCF Demo - Gestion d'acheminement du materiel roulant.

Validation par fichiers:
- README.md: nom projet, stack, comptes de demo, endpoints, scenarios.
- docker-compose.yml: backend + frontend + postgres (option conteneurisée).
- .env.example: variables backend globales de demarrage local.
- backend/.env.example: variables backend applicatives (JWT, CORS, SMTP, upload, references mail).
- frontend/.env.example: VITE_API_URL.
- oncf_demo.db: base SQLite de demo présente à la racine.

## 2) Arborescence commentée (niveau 2–4, hors node_modules/dist)

```text
.
├─ .env.example                           # Variables d'env globales de demo backend
├─ docker-compose.yml                     # Orchestration Postgres + API + frontend
├─ README.md                              # Guide global + comptes + endpoints principaux
├─ oncf_demo.db                           # DB SQLite de demo (racine)
├─ uploads/                               # Dossier d'uploads (racine)
├─ backend/
│  ├─ .env.example                        # Variables backend complètes (SMTP, JWT, CORS...)
│  ├─ Dockerfile                          # Build image API + migration/seed au démarrage
│  ├─ alembic.ini                         # Config Alembic (URL par défaut SQLite)
│  ├─ requirements.txt                    # Dépendances Python
│  ├─ app/
│  │  ├─ main.py                          # Entrée FastAPI, CORS, routers, WS, /uploads
│  │  ├─ seed.py                          # Seed idempotent établissements/gares/users/alertes
│  │  ├─ api/
│  │  │  ├─ auth.py                       # /auth/login, /me
│  │  │  ├─ alerts.py                     # Workflow alertes, décision, réception, notifications
│  │  │  ├─ admin.py                      # Gestion comptes/établissements + export Excel
│  │  │  ├─ meta.py                       # Référentiels gares/établissements
│  │  │  └─ deps.py                       # get_current_user + require_roles
│  │  ├─ core/
│  │  │  ├─ config.py                     # Chargement settings Pydantic
│  │  │  ├─ security.py                   # Hash + verify + JWT
│  │  │  └─ technicentres.py              # Liste codes technicentres autorisés
│  │  ├─ db/
│  │  │  ├─ base.py                       # Declarative Base SQLAlchemy
│  │  │  ├─ session.py                    # Engine/session/get_db
│  │  │  └─ bootstrap.py                  # Migrations SQL impératives au startup
│  │  ├─ models/
│  │  │  ├─ enums.py                      # Enums rôles/statuts/gravité/etc.
│  │  │  ├─ alert.py                      # Modèle principal + historiques + décisions + mails
│  │  │  ├─ user.py                       # Utilisateur
│  │  │  ├─ station.py                    # Gare
│  │  │  └─ establishment.py              # Etablissement
│  │  ├─ schemas/
│  │  │  ├─ auth.py                       # Payloads auth
│  │  │  ├─ alert.py                      # Payloads/lectures alertes
│  │  │  ├─ admin.py                      # Payloads admin
│  │  │  ├─ common.py                     # DTO station/establishment
│  │  │  └─ notification.py               # DTO notifications
│  │  └─ services/
│  │     ├─ alerts.py                     # Helpers métier (history, accès, dérivés)
│  │     ├─ mailing.py                    # Composition + envoi SMTP + log mail_events
│  │     ├─ realtime.py                   # WS connection manager + broadcast JSON
│  │     └─ storage.py                    # Sauvegarde pièces jointes
│  ├─ alembic/
│  │  ├─ env.py                           # Intégration metadata SQLAlchemy
│  │  └─ versions/                        # Révisions DB
│  └─ uploads/                            # Uploads backend servis via /uploads
└─ frontend/
   ├─ .env.example                        # VITE_API_URL
   ├─ Dockerfile                          # Build image Vite (npm run dev --host)
   ├─ package.json                        # Dépendances React/Vite/Leaflet/Three
   ├─ vite.config.ts                      # Config Vite + chunks manuels
   ├─ tailwind.config.js                  # Config Tailwind (brand palette)
   ├─ postcss.config.js                   # Tailwind + Autoprefixer
   ├─ index.html                          # Entrée HTML
   ├─ public/                             # Assets UI (hero/login/logo)
   └─ src/
      ├─ main.tsx                         # BrowserRouter + AuthProvider + AppNotificationsProvider
      ├─ App.tsx                          # Routage protégé par rôles
      ├─ api/client.ts                    # Client HTTP central
      ├─ routes/lazyRoutes.ts             # Lazy loading + preloading routes
      ├─ contexts/
      │  ├─ AuthContext.tsx               # Token/user/login/logout
      │  └─ AppNotificationsContext.tsx   # Toasters temps réel par rôle
      ├─ hooks/                           # useAuth/useLiveAlerts/useKeyboardSelection/...
      ├─ layouts/AppShell.tsx             # Shell global + nav par rôle
      ├─ pages/                           # Pages métier par rôle
      ├─ components/                      # Blocs UI réutilisables (timeline/forms/map)
      ├─ types/index.ts                   # Types front alignés API
      └─ utils/                           # format/status/tracking/api/pdf/materials
```

## 3) Backend détaillé

### 3.1 Point d'entrée et initialisation

Fichier: backend/app/main.py

Comportement startup (lifespan):
- Base.metadata.create_all(bind=engine)
- run_startup_migrations()
- seed_demo_data()

Implication:
- Le démarrage API applique à la fois création de tables ORM, migrations SQL impératives et seed auto.

Configuration serveur:
- FastAPI(title=settings.app_name)
- CORS via settings.parsed_cors_origins + allow_origin_regex localhost/127.0.0.1.
- Routers inclus: auth, meta, alerts, admin.
- StaticFiles monté: /uploads -> settings.upload_dir.
- Healthcheck: GET /health.
- WebSocket: /ws/alerts.

WS:
- Connexion via manager.connect("alerts", websocket).
- Boucle receive_text() (le client envoie un texte de keepalive/subscribe).
- Deconnexion sur WebSocketDisconnect.

### 3.2 Configuration et variables d'environnement

Fichier: backend/app/core/config.py

Variables Settings utilisées:
- app_name
- database_url
- jwt_secret_key
- jwt_algorithm
- access_token_expire_minutes
- cors_origins (CSV)
- upload_dir
- smtp_host
- smtp_port
- smtp_username
- smtp_password
- smtp_use_tls
- smtp_sender_name

Fonctions:
- parsed_cors_origins: split CSV -> list.
- get_settings() avec lru_cache.

Fichiers d'env:
- .env.example (racine): BACKEND_HOST, BACKEND_PORT, DATABASE_URL, JWT_SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES, CORS_ORIGINS.
- backend/.env.example: enrichi SMTP + MAIL_REFERENCE_*.
- frontend/.env.example: VITE_API_URL.

MAIL_REFERENCE_*:
- INCONNU (non utilisées dans le code inspecté).
- Fichiers à vérifier: backend/app/services/mailing.py, backend/app/api/alerts.py.

### 3.3 Sécurité et auth

Fichiers: backend/app/core/security.py, backend/app/api/deps.py, backend/app/api/auth.py

Mécanismes:
- Hash mots de passe: passlib CryptContext bcrypt.
- JWT: python-jose, payload {sub, exp}, secret/algorithme settings.
- OAuth2PasswordBearer tokenUrl=/auth/login.

Routes:
- POST /auth/login
  - Payload: LoginRequest {username, password}
  - Réponse: TokenResponse {access_token, token_type=bearer, user}
  - Erreur: 401 Identifiants invalides
- GET /me
  - Auth Bearer obligatoire
  - Réponse: UserSummary

Dépendances permissions:
- get_current_user: decode JWT, charge User by id (sub), sinon 401.
- require_roles(*roles): sinon 403 Role non autorise.

### 3.4 API par domaine

#### Auth
- POST /auth/login
- GET /me

#### Référentiels
- GET /stations (auth)
- GET /establishments (auth, filtré TECHNICENTRE_CODES)

#### Alertes & workflow
- POST /alerts
  - Rôles: AGENT, ETABLISSEMENT, ADMIN
  - Multipart FormData (champs métier + files[])
  - Crée alerte + history EN_COURS_DE_TRAITEMENT + attachments + mail event REQUEST_CREATED + broadcast WS alert_created
  - Erreurs: 404 gare/établissement introuvable, 422 validation form
- PUT /alerts/{alert_id}
  - Rôles: AGENT, ETABLISSEMENT, ADMIN
  - Conditions: auteur (ou admin), status=A_MODIFIER, pas de décision/confimation existante
  - Archive révision (alert_revisions), met à jour alerte, history, mail REQUEST_UPDATED, WS alert_updated
  - Erreurs: 403, 400 statut non modifiable, 404
- GET /alerts
  - Rôles: tout utilisateur authentifié
  - Filtres: mine, status, severity
  - Portée selon rôle:
    - AGENT: ses alertes
    - ETABLISSEMENT: alertes orientées vers son establishment
    - PERMANENT/ADMIN/SUIVI: vues larges
- GET /alerts/{alert_id}
  - Contrôle d'accès via authorize_alert_access
  - ETABLISSEMENT destinataire: marque notification read_at
- POST /alerts/{alert_id}/status
  - Rôles: PERMANENT, ADMIN
  - Autorise seulement status=EN_COURS_DE_TRAITEMENT
  - Ajoute history + WS status_updated
- POST /alerts/{alert_id}/decision
  - Rôles: PERMANENT, ADMIN
  - Décision unique par alerte
  - decision=MODIFIER: status A_MODIFIER + mail DECISION_MODIFIER
  - decision=ANNULER: status ANNULEE + mail DECISION_ANNULER
  - decision=CONFIRMER: crée PermanentDecision + Notification + status VALIDEE_PAR_LE_PERMANENT + mail DECISION_CONFIRMER
  - Broadcast WS decision_created
- GET /notifications
  - Rôles: ETABLISSEMENT, ADMIN
  - ETABLISSEMENT sans establishment_id -> 400
- POST /alerts/{alert_id}/confirm
  - Rôles: ETABLISSEMENT, ADMIN
  - Gère confirmation partielle/complète:
    - calcule delay_minutes vs ETA
    - fusionne confirmed_material_indexes si partiel existant
    - status RECEPTION_PARTIELLE ou RECEPTION_CONFIRMEE
    - mail RECEPTION_PARTIELLE/RECEPTION_CONFIRMEE
    - WS reception_confirmed
  - Erreurs: 400 sélection invalide, déjà confirmée, utilisateur sans establishment, décision absente
- POST /alerts/{alert_id}/reception-issue
  - Rôles: ETABLISSEMENT, ADMIN
  - status RECEPTION_PROBLEME_SIGNALE + mail + WS reception_issue_reported
- POST /alerts/{alert_id}/reception-issue/resolve
  - Rôles: PERMANENT, ADMIN
  - Seulement si status actuel RECEPTION_PROBLEME_SIGNALE
  - action=ANNULER -> status ANNULEE + mail
  - action=RELANCER -> MAJ ETA/conditions + Notification + status VALIDEE_PAR_LE_PERMANENT + mail
  - WS reception_issue_resolved

#### Administration
Préfixe router: /admin

- GET /admin/users
  - Rôle: ADMIN
  - Retourne comptes hors AGENT, et ETABLISSEMENT filtrés sur TECHNICENTRE_CODES
- POST /admin/establishments
- PUT /admin/establishments/{establishment_id}
  - Rôle: ADMIN
  - Vérifie unicité code et nom
- POST /admin/users
- GET /admin/users/{user_id}
- PUT /admin/users/{user_id}
- PUT /admin/users/{user_id}/password
- DELETE /admin/users/{user_id}
  - Rôle: ADMIN
  - Interdit auto-suppression
  - Interdit suppression compte avec historique métier
- GET /admin/users/{user_id}/export
  - Rôle: ADMIN
  - Produit XLSX (openpyxl)
  - Plages supportées:
    - start_date/end_date
    - legacy period_type (year/month/week/day)

Codes d'erreur importants observés:
- 400: règles métier violées (modification non autorisée à ce statut, motif obligatoire, etc.)
- 401: jeton invalide / session expirée
- 403: rôle insuffisant / accès refusé
- 404: entité introuvable
- 422: validation Pydantic/Form

### 3.5 Modèle de données

Fichiers: backend/app/models/alert.py, user.py, station.py, establishment.py, enums.py

Entités principales:
- User: username unique, role, full_name, outlook_email, establishment_id.
- Establishment: code unique, name, city, lat/lon, outlook_email.
- Station: code unique, name, region, lat/lon.
- Alert: coeur workflow.
  - Champs métier: material_type/ref/concerned, request_date, speed_kmh, transport_mode/type, problem_description, maintenance_state, severity, transport_conditions_initial, agent_decision, status.
  - Relations: created_by, station, requested_destination_establishment, history, permanent_decision, establishment_confirmation, notifications, attachments, revisions, mail_events.
- AlertStatusHistory: transitions statut + note + auteur.
- PermanentDecision: décision permanent (destination, conditions finales, ETA, comment).
- EstablishmentConfirmation: réception (date, indexes matériel, retard, remarques).
- Notification: notification vers établissement.
- AlertAttachment: pièce jointe.
- AlertRevision: snapshot versionnement d'une demande modifiée.
- MailEvent: journal d'envoi e-mail.

Enums (backend/app/models/enums.py):
- UserRole: AGENT, PERMANENT, ETABLISSEMENT, ADMIN, SUIVI
- MaterialType: MM, MR
- MaintenanceState: OK, A_SURVEILLER, PFL, PV, A_REPARER, CRITIQUE
- Severity: NIVEAU_1..NIVEAU_5
- AgentDecision: CONFIRMER, ANNULER
- AlertStatus: EN_COURS_DE_TRAITEMENT, A_MODIFIER, VALIDEE_PAR_LE_PERMANENT, ANNULEE, RECEPTION_PARTIELLE, RECEPTION_PROBLEME_SIGNALE, RECEPTION_CONFIRMEE
- DecisionKind: CONFIRMER, ANNULER

### 3.6 Schémas Pydantic

Fichiers: backend/app/schemas/*

- auth.py: LoginRequest, TokenResponse, UserSummary
- common.py: StationRead, EstablishmentRead
- alert.py:
  - Entrée: AlertCreate, AlertUpdate, AlertStatusUpdate, PermanentDecisionCreate, EstablishmentConfirmationCreate, ReceptionIssueReportCreate, ReceptionIssueResolutionCreate
  - Sortie: AlertRead + sous-objets (history, revision, decision, confirmation, attachments, mail events)
- notification.py: NotificationRead
- admin.py: DTO CRUD users/establishments + historique activité

### 3.7 Accès DB/session

Fichiers: backend/app/db/session.py, backend/app/db/base.py

- engine SQLAlchemy créé depuis settings.database_url.
- SQLite: connect_args check_same_thread=False.
- SessionLocal sessionmaker(expire_on_commit=False).
- get_db() yield/finally close.
- Base hérite DeclarativeBase.

### 3.8 Migrations et stratégie bootstrap

Fichiers:
- backend/app/db/bootstrap.py
- backend/alembic/env.py
- backend/alembic/versions/*.py

Stratégie observée:
1) ORM create_all au startup (main.py)
2) run_startup_migrations() exécute SQL CREATE TABLE IF NOT EXISTS / ALTER TABLE pour compatibilité incrémentale
3) Alembic disponible (migration classique)

Conséquence:
- Double stratégie (startup imperative + Alembic) coexistante.
- Pratique pour demo locale évolutive, mais nécessite vigilance en prod pour éviter dérives de schéma.

Point d'attention migration:
- backend/alembic/versions/20260412_0002_alert_mailing_and_fields.py a down_revision=20260310_0001.
- backend/alembic/versions/20260410_0004_add_transport_type_to_alerts.py poursuit la chaîne 0002->0003->0004.
- Cela crée une branche Alembic parallèle potentielle (à valider selon historique réel).

### 3.9 Services

#### realtime.py
- ConnectionManager par channel.
- broadcast(channel, payload dict) => JSON texte.

#### storage.py
- ensure_upload_dir()
- save_upload(file): nom UUID + extension, écrit binaire, retourne (safe_name, public_path=/uploads/...)

#### mailing.py
- Compose messages métier (création, décision, modification, MAJ demande, confirmation réception).
- send_alert_mail:
  - normalise destinataires
  - journalise MailEvent
  - gère modes: NO_RECIPIENT, CONFIGURATION_MANQUANTE, SENT, FAILED
  - SMTP avec TLS optionnel

#### alerts.py (service)
- Helpers métier: add_history, ensure_station_exists, ensure_establishment_exists, authorize_alert_access, mark_notification_as_read, compute_delay_minutes, get_alert_or_404.
- Point critique: bloc SQLite exécutable en fin de fichier supprime alerte id=51 à l'import.
  - Risque élevé de perte de données en runtime.
  - Fichier concerné: backend/app/services/alerts.py (fin de fichier).

### 3.10 Seed/demo

Fichier: backend/app/seed.py

Comportement:
- _ensure_establishments: crée établissements à partir de TECHNICENTRE_DEFINITIONS.
- _ensure_stations: crée/met à jour gares STATION_DEFINITIONS.
- _ensure_core_users:
  - admin/pass123 (ADMIN)
  - permanent/pass123 (PERMANENT)
  - suivi/pass123 (SUIVI)
  - 1 compte ETABLISSEMENT par code technicentre (username=code lower, ex tmic/pass123)
- _seed_demo_alerts: crée 3 alertes démo seulement si aucune alerte n'existe déjà.

Idempotence:
- Oui sur établissements, gares, users (upsert-like logique applicative).
- Les alertes de demo ne sont injectées que si table alerts vide.

### 3.11 Uploads

Stockage:
- Répertoire settings.upload_dir (par défaut uploads), créé au startup.
- Fichier écrit via save_upload (services/storage.py).

Exposition:
- Montage statique FastAPI: /uploads.

Endpoints impliqués:
- POST /alerts accepte files[] (multipart).
- Les pièces jointes sont restituées dans AlertRead.attachments.stored_path.
- Frontend ouvre URL API_BASE_URL + stored_path.

### 3.12 Endpoints structurés avec permissions et payloads

Résumé opérationnel:
- Auth:
  - POST /auth/login (public)
  - GET /me (auth)
- Référentiels:
  - GET /stations (auth)
  - GET /establishments (auth)
- Alertes:
  - POST /alerts (AGENT|ETABLISSEMENT|ADMIN, multipart)
  - PUT /alerts/{id} (AGENT|ETABLISSEMENT|ADMIN, JSON)
  - GET /alerts (auth)
  - GET /alerts/{id} (auth + authorize_alert_access)
  - POST /alerts/{id}/status (PERMANENT|ADMIN)
  - POST /alerts/{id}/decision (PERMANENT|ADMIN)
  - GET /notifications (ETABLISSEMENT|ADMIN)
  - POST /alerts/{id}/confirm (ETABLISSEMENT|ADMIN)
  - POST /alerts/{id}/reception-issue (ETABLISSEMENT|ADMIN)
  - POST /alerts/{id}/reception-issue/resolve (PERMANENT|ADMIN)
- Admin:
  - GET /admin/users (ADMIN)
  - POST /admin/establishments (ADMIN)
  - PUT /admin/establishments/{id} (ADMIN)
  - POST /admin/users (ADMIN)
  - GET /admin/users/{id} (ADMIN)
  - GET /admin/users/{id}/export (ADMIN)
  - PUT /admin/users/{id} (ADMIN)
  - PUT /admin/users/{id}/password (ADMIN)
  - DELETE /admin/users/{id} (ADMIN)
- Technique:
  - GET /health
  - WS /ws/alerts

### 3.13 Temps réel WS /ws/alerts

Serveur:
- backend/app/main.py + backend/app/services/realtime.py
- Payload broadcast: JSON sérialisé.

Types diffusés observés:
- alert_created
- alert_updated
- status_updated
- decision_created
- reception_confirmed
- reception_issue_reported
- reception_issue_resolved

Exemples de format:
- {"type":"alert_created","alert_id":123,"status":"EN_COURS_DE_TRAITEMENT"}
- {"type":"status_updated","alert_id":123,"status":"EN_COURS_DE_TRAITEMENT","note":"..."}
- {"type":"reception_issue_resolved","alert_id":123,"status":"VALIDEE_PAR_LE_PERMANENT","note":"..."}

## 4) Frontend détaillé

### 4.1 Point d'entrée

Fichier: frontend/src/main.tsx
- React.StrictMode
- BrowserRouter
- AuthProvider
- AppNotificationsProvider
- App
- Styles globaux frontend/src/index.css + leaflet CSS

### 4.2 Routage et rôles

Fichiers: frontend/src/App.tsx, frontend/src/routes/lazyRoutes.ts

Mécanisme:
- Lazy loading de toutes les pages via React.lazy + Suspense.
- RequireAuth vérifie ready, token, user, rôles autorisés.
- Redirections role-based si accès route interdit:
  - PERMANENT -> /permanent/dashboard
  - ADMIN -> /admin/dashboard
  - SUIVI -> /tracking/dashboard
  - sinon -> /technicentre/dashboard

Routes principales:
- /login
- /technicentre/* (AGENT|ETABLISSEMENT)
- /agent/* (AGENT|ETABLISSEMENT)
- /establishment/* (AGENT|ETABLISSEMENT)
- /permanent/* (PERMANENT)
- /admin/* (ADMIN)
- /tracking/* (SUIVI)

### 4.3 Auth frontend

Fichiers: frontend/src/contexts/AuthContext.tsx, frontend/src/hooks/useAuth.ts

- Stockage localStorage:
  - oncf_token
  - oncf_user
- Au mount si token: appel api.me(token) pour revalider session.
- login(username,password): api.login puis persistance localStorage.
- logout: purge token/user localStorage + state.

### 4.4 Client API

Fichiers: frontend/src/api/client.ts, frontend/src/utils/api.ts

Base URL:
- API_BASE_URL = import.meta.env.VITE_API_URL ?? http://localhost:8000

Comportement requêtes:
- JSON par défaut (Content-Type application/json).
- Exception createAlert: FormData (pas de Content-Type forcé).
- Authorization: Bearer token.
- 401: suppression localStorage token/user + erreur Session expirée.
- exportAdminUser: requête blob.

### 4.5 Pages et rôle fonctionnel

Pages et routes (source App.tsx + lazyRoutes.ts):

- LoginPage
  - Route: /login
  - Rôle: authentification et redirection selon rôle.
- TechnicentreHomePage
  - Routes: /technicentre, /technicentre/dashboard, /establishment/dashboard
  - Rôle: synthèse technicentre (notifications + demandes A_MODIFIER).
- TechnicentreDemandPage
  - Route: /technicentre/demande
  - Rôle: demandes mine=true avec filtres/recherche.
- TechnicentreModificationRequestsPage
  - Route: /technicentre/demande/modifications
  - Rôle: dossiers à modifier.
- NewAlertPage
  - Routes: /technicentre/demande/create, /agent/alerts/new, /technicentre/alerts/:id/edit, /agent/alerts/:id/edit
  - Rôle: création/édition demande, payload FormData pour création (pièces jointes), JSON pour update.
- TechnicentreRequestHistoryPage
  - Route: /technicentre/demande/history
  - Rôle: historique demandes créées.
- AgentAlertDetailPage
  - Routes: /agent/alerts/:id, /technicentre/demande/history/:id, /technicentre/alerts/:id
  - Rôle: détail demande côté demandeur.
- TechnicentreReceptionListPage
  - Route: /technicentre/reception
  - Rôle: liste notifications réception à traiter.
- TechnicentreReceptionDetailPage
  - Routes: /technicentre/reception/:id, /technicentre/reception/history/:id
  - Rôle: confirmer réception partielle/complète, signaler problème.
- TechnicentreReceptionHistoryPage
  - Route: /technicentre/reception/history
  - Rôle: historique réceptions.
- AgentDashboard
  - Routes: /agent/dashboard, /agent/alerts
  - Rôle: listing simplifié alertes mine=true.
- EstablishmentProgressPage
  - Route: /establishment/progress
  - Rôle: progression des transports + confirmation réception.
- EstablishmentHistoryPage
  - Route: /establishment/history
  - Rôle: historique notifications/réceptions.
- EstablishmentDashboard
  - INCONNU côté routage actif (composant existe mais non route directe dans App.tsx actuel).
  - Fichiers à vérifier: frontend/src/App.tsx, frontend/src/pages/EstablishmentDashboard.tsx.
- PermanentDashboard
  - Route: /permanent/dashboard
  - Rôle: backlog permanent + filtres statut + live WS.
- PermanentAlertDetailPage
  - Route: /permanent/dashboard/:id
  - Rôle: prise de décision, résolution problème réception.
- PermanentMapPage
  - Route: /permanent/map
  - Rôle: carte Leaflet avec alertes live.
- AdminDashboard
  - Routes: /admin/dashboard, /admin/accounts
  - Rôle: gestion comptes et création compte.
- AdminUserDetailPage
  - Route: /admin/users/:id
  - Rôle: mise à jour compte, mot de passe, établissement, export Excel/CSV, suppression compte, navigation vers alertes du compte.
- AdminAlertDetailPage
  - Route: /admin/users/:userId/alerts/:alertId
  - Rôle: détail alerte en contexte admin.
- TrackingDashboardPage (SUIVI)
  - Route: /tracking/dashboard
  - Rôle: carte nationale des acheminements, alert tones live, état gares.
- TrackingAllPage (SUIVI)
  - Route: /tracking/all
  - Rôle: liste globale des acheminements en cours + timeline détaillée.
- TrackingPlaybackPage (SUIVI)
  - Route: /tracking/playback
  - Rôle: visualisation 2D trajectoire (TrainMap2D).

### 4.6 Organisation composants/layouts/contexts/hooks/types/utils

Organisation:
- components/: composants de présentation et formulaires métier (DecisionForm, ConfirmationForm, AlertTimeline, StatusBadge, TrainMap2D...).
- layouts/AppShell.tsx: coque UI commune, nav par rôle, preload routes à l'idle.
- contexts/: état transversal auth + notifications temps réel.
- hooks/: wrappers context, websocket live, navigation clavier (J/K, flèches).
- types/index.ts: contrat TypeScript du domaine aligné backend.
- utils/: format/date, statuts métier, progression tracking, API base URL, génération PDF, parsing materials.

Patterns notables:
- client API unique (frontend/src/api/client.ts).
- accès conditionnel par rôle dans route guard.
- DTO front proches des schémas backend.
- live update par websocket centralisé (useLiveAlerts) + toasts contextuels.

### 4.7 UI / styles / build

Fichiers: frontend/src/index.css, tailwind.config.js, postcss.config.js, vite.config.ts

- Tailwind activé, palette brand orange.
- CSS custom riche (animations alert/map/login/dashboard).
- Vite:
  - server port 5173
  - manualChunks: react-vendor, map-vendor, three-vendor.

## 5) Workflows métier (scénarios)

### 5.1 Création alerte -> décision permanent -> notification -> confirmation réception

1. Demandeur (AGENT/ETABLISSEMENT/ADMIN) crée une alerte via POST /alerts.
2. Statut initial: EN_COURS_DE_TRAITEMENT + historique.
3. Permanent (ou admin) traite via POST /alerts/{id}/decision.
4. Si CONFIRMER:
   - création PermanentDecision
   - création Notification vers établissement destinataire
   - statut VALIDEE_PAR_LE_PERMANENT
5. Etablissement (ou admin) confirme via POST /alerts/{id}/confirm:
   - statut RECEPTION_PARTIELLE ou RECEPTION_CONFIRMEE selon matériel confirmé.
6. MailEvents enregistrés à chaque étape prévue.
7. Broadcast WS envoyé sur chaque événement majeur.

### 5.2 Cas Demande à modifier

1. Permanent envoie decision=MODIFIER (commentaire obligatoire).
2. Statut A_MODIFIER + mail de demande de correction.
3. Demandeur édite la demande via PUT /alerts/{id}:
   - uniquement si statut A_MODIFIER
   - archive version précédente dans alert_revisions
   - retour statut EN_COURS_DE_TRAITEMENT.

### 5.3 Cas Annulation

- Annulation directe:
  - decision=ANNULER (commentaire obligatoire)
  - statut ANNULEE + mail.
- Annulation après problème de réception:
  - POST /alerts/{id}/reception-issue/resolve avec action=ANNULER
  - statut ANNULEE + mail.

### 5.4 Réception partielle / problème signalé / résolution

Réception partielle:
- confirm avec subset de confirmed_material_indexes.
- statut RECEPTION_PARTIELLE.
- confirmations ultérieures fusionnent les indexes.

Problème signalé:
- POST /alerts/{id}/reception-issue (motif).
- statut RECEPTION_PROBLEME_SIGNALE.

Résolution:
- permanent/admin POST /alerts/{id}/reception-issue/resolve.
- action RELANCER:
  - met à jour ETA/conditions finales/comment.
  - recrée notification établissement.
  - statut VALIDEE_PAR_LE_PERMANENT.
- action ANNULER:
  - statut ANNULEE.

### 5.5 Admin: gestion comptes + export Excel

Gestion:
- CRUD comptes via /admin/users*.
- CRUD établissements via /admin/establishments*.
- contraintes suppression: pas d'auto-suppression admin, pas de suppression si historique.

Export:
- backend: /admin/users/{id}/export -> XLSX (openpyxl).
- frontend: AdminUserDetailPage déclenche téléchargement blob.
- cas SUIVI dans UI: génération CSV côté frontend (pas endpoint dédié spécifique SUIVI).

### 5.6 SUIVI / Tracking

Rôle SUIVI:
- autorisé dans enums backend + route guard frontend.
- peut consulter alertes globales (authorize_alert_access autorise SUIVI).
- vues:
  - /tracking/dashboard (carte réseau live)
  - /tracking/all (liste en cours)
  - /tracking/playback (trajets 2D)

Origine des données:
- API /alerts + /stations.
- websocket /ws/alerts pour rafraîchissement temps réel.
- fonctions de calcul front dans utils/tracking.ts et utils/railNetwork.ts.

## 6) Exécution / Runbook

### 6.1 Pré-requis

- Python 3.11 (cf backend Dockerfile python:3.11-slim)
- Node.js 22 recommandé (cf frontend Dockerfile node:22-alpine)
- npm
- (optionnel) Docker + Docker Compose

### 6.2 Mode local sans Docker

Backend:

1. Ouvrir terminal à la racine.
2. Commandes:

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

Frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

URLs:
- API: http://localhost:8000
- Front: http://localhost:5173

### 6.3 Mode Docker Compose

Commande:

```powershell
docker compose up --build
```

Services (docker-compose.yml):
- postgres (16-alpine): 5432
- backend: 8000
  - DATABASE_URL postgresql+psycopg://oncf:oncf@postgres:5432/oncf_demo
  - JWT_SECRET_KEY
  - CORS_ORIGINS
- frontend: 5173

### 6.4 Dépendances et ordre de démarrage

- compose dépendances:
  - backend depends_on postgres
  - frontend depends_on backend
- backend container CMD:
  - alembic upgrade head
  - python -m app.seed
  - uvicorn ...

### 6.5 Troubleshooting

CORS
- Vérifier CORS_ORIGINS dans .env / compose.
- Vérifier VITE_API_URL frontend/.env.

DB URL
- Local SQLite attendu: sqlite:///./oncf_demo.db.
- Compose PostgreSQL attendu: postgresql+psycopg://...@postgres:5432/oncf_demo.

Ports
- Conflits possibles: 5173, 8000, 5432.

JWT
- JWT_SECRET_KEY vide/faible -> auth cassée ou non sécurisée.
- Vérifier token expiré (ACCESS_TOKEN_EXPIRE_MINUTES).

WebSocket
- Endpoint client: ws(s)://<api>/ws/alerts.
- Si pas de live: vérifier reverse proxy, CORS, réseau container.

SMTP
- Si non configuré: MailEvent delivery_status=CONFIGURATION_MANQUANTE ou NO_RECIPIENT.
- Vérifier backend/.env.example variables SMTP_* et outlook_email des comptes/établissements.

## 7) Éléments INCONNU / à vérifier

- Usage effectif des variables MAIL_REFERENCE_*: INCONNU.
  - Vérifier: backend/app/services/mailing.py, backend/app/api/alerts.py.
- Politique de déploiement prod (gunicorn, reverse proxy, TLS): INCONNU.
  - Vérifier: README.md, éventuels fichiers infra absents.
- Tests automatisés (unit/intégration/e2e): INCONNU (aucun dossier tests repéré dans l'arborescence inspectée).
  - Vérifier: recherche complémentaire hors profondeur 4 si nécessaire.

## 8) Risques/points d'attention pour reprise

1. Bloc destructif dans backend/app/services/alerts.py qui exécute une suppression SQLite à l'import.
2. Coexistence create_all + bootstrap SQL + Alembic: risque de divergence de schéma.
3. Arborescence contient fichiers runtime (logs uvicorn, __pycache__, backend/oncf_demo.db en plus de racine).
4. Frontend dépend de données géolocalisées pour cartes tracking; établissements sans lat/lon limitent certaines vues.
5. Export SUIVI dans UI admin est généré en CSV côté front, différent du flux XLSX backend.
