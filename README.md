# Marathon Bib Expo Frontend

An Angular 21 single-page application for managing marathon bib distribution operations. It provides role-based dashboards, event and participant management, bib/goodies distribution with QR scanning, messaging campaigns, billing, and public bib verification for the Marathon Bib Expo platform.

## Prerequisites

- Node.js 20.19 or higher (22.12+ / 24+ also supported)
- npm 10 or higher

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure the API Base URL

You normally **don't** need to change anything. The API base URL comes from the
environment files:

- `src/environments/environment.ts` — development
- `src/environments/environment.prod.ts` — production (swapped in at build time via `fileReplacements` in `angular.json`)

Both default to the **relative, same-origin path `/api`**, so one build artifact
works on any host:

- **Dev** — the dev server proxies `/api/*` to the backend at `http://localhost:8080` via `proxy.conf.json`.
- **Prod** — nginx serves the built app and proxies `/api` to the Spring Boot backend on the same box.

Keeping the frontend and backend same-origin is what lets the HttpOnly refresh
cookie and the CSRF cookie work — including over plain HTTP from another device
on the LAN. **Avoid pointing `apiBaseUrl` at an absolute cross-origin URL**; that
breaks the cookie auth model. To reach a backend on a different machine in dev,
change the `target` in `proxy.conf.json` instead.

### 3. Start the Development Server

```bash
npm start
```

The application starts at **http://localhost:4200**.

---

## Tech Stack

| Layer             | Technology                        |
| ----------------- | --------------------------------- |
| Language          | TypeScript 5.x                    |
| Framework         | Angular 21 (standalone, signals)  |
| Component Library | PrimeNG 21                        |
| Styling           | Tailwind CSS 4.x                  |
| HTTP              | Angular HttpClient + Interceptors |
| Routing           | Angular Router (lazy-loaded)      |
| Offline / PWA     | Angular Service Worker            |
| Testing           | Vitest 4.x                        |
| Linting           | ESLint + Angular ESLint           |
| Formatting        | Prettier                          |
| Git Hooks         | Husky + lint-staged               |

---

## Architecture

All components are **standalone** — no NgModule pattern is used anywhere in the project. The codebase is organized by feature area; each feature owns its own routes, components, and services.

```
src/app/
├── core/          # Guards, interceptors, singleton services, domain models
├── layout/        # App shell: navbar, sidebar, AI assistant, command palette, theme
├── features/      # Lazy-loaded feature areas
│   ├── auth/                # login, password reset, invitations
│   ├── dashboard/           # role-aware sub-dashboards (root, admin, org, distributor)
│   ├── events/              # event CRUD + nested tabs (races, categories, campaigns, limits, bills)
│   ├── organizations/       # organization CRUD + settings
│   ├── users/               # user CRUD, invite links, account controls
│   ├── participants/        # participant CRUD, CSV import/export, import history
│   ├── import-mapper/       # drag-to-map CSV → participant import wizard
│   ├── distribution/        # bib/goodies distribution, QR scanning, activity logs
│   ├── billing/             # platform billing console
│   ├── system-messaging/    # provider config + system templates
│   ├── campaign-providers/  # SMS/WhatsApp campaign sender providers
│   ├── audit-logs/          # audit log feed with filters
│   ├── notifications/       # in-app notification center
│   ├── public-verification/ # public bib verification + expo card (no auth)
│   └── errors/              # not-found, unauthorized
├── shared/        # Reusable list shell, pipes, utils, constants, base classes
└── app.ts | app.routes.ts | app.config.ts | app.html
```

---

## Key Features

- **Role-Based Dashboards** — scope-aware views for ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER, and DISTRIBUTOR roles with statistics and charts
- **Event Management** — events with races, categories, participant limits, billing, and SMS/WhatsApp campaign tabs
- **Participant Management** — CRUD, cursor-paginated virtualized tables, CSV import with a drag-to-map column wizard, and export
- **Distribution** — bib/goodies handout with QR bib scanning, pending queues, and activity logs
- **Messaging Campaigns** — SMS/WhatsApp templates and campaigns with configurable sender providers
- **Public Verification** — unauthenticated bib verification and downloadable expo cards via short links
- **AI Assistant** — in-app conversational assistant with human-in-the-loop action approvals
- **PWA / Offline** — installable app, cached shell, offline write guarding, and update prompts
- **Notifications** — in-app notification bell and full notification page
- **Audit Logs** — filterable audit trail of user actions
- **Shared Table Base** — debounced search, pagination, persisted column/filter preferences, and skeleton loading via `BaseTableComponent`
- **Centralized Error Handling** — `ErrorHandlerService` with toast notifications; components never implement custom error parsing

---

## Authentication

The app authenticates against the [Marathon Bib Expo Service](https://github.com/s-banerjee94/marathon-bib-expo-service) backend using short-lived access tokens with cookie-based refresh:

1. POST credentials to `/api/auth/login`; the backend sets an **HttpOnly refresh cookie** and returns a short-lived access token
2. The access token is held **in memory only** and injected into requests by `authInterceptor`, along with a double-submit **CSRF token** header
3. On startup the session is silently restored from the refresh cookie; on 401 the token is refreshed and the request retried
4. Only a genuine refresh rejection logs the user out and redirects to `/login`

---

## User Roles

| Role              | Description                                       |
| ----------------- | ------------------------------------------------- |
| `ROOT`            | Full system access across all organizations       |
| `ADMIN`           | System-level admin access                         |
| `ORGANIZER_ADMIN` | Admin for their own organization                  |
| `ORGANIZER_USER`  | Standard user within an organization              |
| `DISTRIBUTOR`     | Bib/goodies distribution for their assigned event |

---

## Development Commands

```bash
npm start          # Start dev server at http://localhost:4200
npm run build      # Production build (outputs to dist/)
npm run watch      # Watch mode build
npm test           # Run Vitest unit tests
npm run lint       # Lint TypeScript and HTML files
npm run format     # Format all files with Prettier
```

### Scaffolding

```bash
# Generate a standalone component
ng generate component features/module-name/component-name --skip-tests --skip-import
```

---

## Backend

This frontend is designed to work with the **Marathon Bib Expo Service** backend:

**Repository:** https://github.com/s-banerjee94/marathon-bib-expo-service

The backend provides authentication, user/organization/event management, participant tracking, bib and goodies distribution, CSV batch import, messaging campaigns, billing, and notifications.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](LICENSE) file for details.

Anyone who uses, modifies, or runs this software as a service must release their source code under the same license.
