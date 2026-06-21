# Marathon Bib Expo Frontend

An Angular 21 single-page application for managing marathon bib distribution operations. This frontend provides role-based dashboards, participant management, organization administration, and real-time event tracking for the Marathon Bib Expo platform.

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Base URL

You normally **don't** need to change anything. The API base URL comes from the
environment files, not a hand-edited constant:

- `src/environments/environment.ts` — development
- `src/environments/environment.prod.ts` — production (swapped in at build time via the `fileReplacements` in `angular.json`)

Both default to the **relative, same-origin path `/api`**:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};
```

A relative path is intentional and means **one build artifact works on any host**:

- **Dev** — the dev server proxies `/api/*` (and `/s/*`) to the backend at `http://localhost:8080` via `proxy.conf.json`.
- **Prod** — nginx serves the built app and proxies `/api` (and `/s`) to the Spring Boot backend on the same box.

Keeping the frontend and backend **same-origin** is what lets the HttpOnly refresh
cookie and the readable CSRF cookie work — including over plain HTTP from another
device (e.g. your phone) on the LAN. **Avoid pointing `apiBaseUrl` at an absolute
cross-origin URL** (e.g. `http://192.168.0.106:8080/api`); that breaks the cookie
auth model. To reach a backend on a different machine in dev, change the `target`
in `proxy.conf.json` instead.

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
| Framework         | Angular 21                        |
| Component Library | PrimeNG 21                        |
| Styling           | Tailwind CSS 4.x                  |
| State Management  | Angular Signals                   |
| HTTP              | Angular HttpClient + Interceptors |
| Routing           | Angular Router (lazy-loaded)      |
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
├── layout/        # App shell: navbar, sidebar, selectors, theme switcher
├── features/      # Lazy-loaded feature areas
│   ├── auth/         # login
│   ├── dashboard/    # role-aware sub-dashboards (root, admin, org-admin, …)
│   ├── events/       # event-list, event-form, event-details (with nested tabs)
│   ├── organizations/
│   ├── users/
│   ├── participants/ # list (+ tabs and dialogs), form
│   ├── distribution/ # manage-distribution (+ tabs)
│   └── errors/       # not-found, unauthorized
├── shared/        # Reusable list shell, pipes, utils, constants, base classes
└── app.ts | app.routes.ts | app.config.ts | app.html
```

---

## Key Features

- **Role-Based Dashboards** — separate dashboard views for ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER, and DISTRIBUTOR roles with scope-aware statistics and charts
- **User Management** — create, edit, search, filter, and paginate users with role and organization assignment
- **Organization Management** — full CRUD for organizations with subscription tier, enable/disable controls, and capacity tracking
- **JWT Authentication** — stateless Bearer token auth with automatic injection via HTTP interceptor and 401 redirect on expiry
- **Lazy Loading** — all feature routes are lazy-loaded for optimal bundle size
- **BaseTableComponent** — shared base class providing debounced search, pagination, column selection (persisted to localStorage), skeleton loading, and filter preferences
- **Global Error Handling** — centralized `ErrorHandlerService` with PrimeNG toast notifications; components never implement custom error parsing
- **Smooth Animations** — Angular animations for sidebar slide transitions

---

## Authentication

The app authenticates against the [Marathon Bib Expo Service](https://github.com/s-banerjee94/marathon-bib-expo-service) backend.

**Login flow:**

1. POST credentials to `/api/auth/login`
2. Backend returns a JWT token + user info
3. Token stored in `localStorage` and injected into all subsequent requests by `authInterceptor`
4. On 401, `errorInterceptor` auto-logs out and redirects to `/login`

---

## User Roles

| Role              | Description                                 |
| ----------------- | ------------------------------------------- |
| `ROOT`            | Full system access across all organizations |
| `ADMIN`           | System-level admin access                   |
| `ORGANIZER_ADMIN` | Admin for their own organization            |
| `ORGANIZER_USER`  | Standard user within an organization        |
| `DISTRIBUTOR`     | Can perform bib/goodies distribution only   |

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

The backend provides JWT authentication, user/organization/event management, participant tracking, bib and goodies distribution, CSV batch import, and real-time SSE notifications.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](LICENSE) file for details.

Anyone who uses, modifies, or runs this software as a service must release their source code under the same license.
