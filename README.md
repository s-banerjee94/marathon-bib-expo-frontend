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

Open `src/app/shared/constants/api.constant.ts` and set the backend URL:

```typescript
// For local backend
export const BASE_URI = 'http://localhost:8080/api';

// For network backend
// export const BASE_URI = 'http://192.168.0.106:8080/api';
```

### 3. Start the Development Server

```bash
npm start
```

The application starts at **http://localhost:4200**.

> The dev server proxies `/api/*` requests to `http://localhost:8080` via `proxy.conf.json`.

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

All components are **standalone** — no NgModule pattern is used anywhere in the project.

```
src/app/
├── core/                     # Infrastructure: auth, guards, interceptors, services
│   ├── guards/               # Functional route guards (authGuard, rootGuard, adminGuard, …)
│   ├── interceptors/         # authInterceptor (JWT injection), errorInterceptor (401 redirect)
│   ├── models/               # Domain models (User, Organization, Role enums, API types)
│   └── services/             # AuthService, UserService, OrganizationService, ErrorHandlerService
│
├── features/                 # Feature components (lazy-loaded via router)
│   ├── auth/login/           # Login page
│   ├── root-dashboard/       # ROOT role dashboard
│   ├── admin-dashboard/      # ADMIN role dashboard
│   ├── org-admin-dashboard/  # ORGANIZER_ADMIN dashboard
│   ├── org-user-dashboard/   # ORGANIZER_USER dashboard
│   ├── distributer-dashboard/# DISTRIBUTOR dashboard
│   ├── user-list/            # User list with search, filter, pagination
│   ├── organization-list/    # Organization list with search, filter, pagination
│   ├── manage-user/          # User create/edit dialog
│   └── manage-organization/  # Organization create/edit dialog
│
├── components/
│   └── navbar/               # App navigation with role-aware sidebar
│
├── shared/                   # Reusable utilities, constants, pipes
│   ├── base/                 # BaseTableComponent — base class for all list views
│   ├── constants/            # Storage keys, column definitions, sort options, form sizes
│   ├── models/               # Table config interfaces
│   └── pipes/                # DefaultValuePipe (shows '--' for null/undefined)
│
├── app.ts                    # Root component
├── app.config.ts             # DI providers (router, HttpClient, PrimeNG)
├── app.routes.ts             # All route definitions
└── app.html                  # Root template
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
