# Marathon Bib Expo Frontend

An Angular 21 single-page application for managing marathon bib distribution operations. It provides role-based dashboards, event and participant management, bib/goodies distribution with QR scanning, messaging campaigns, billing, and public bib verification for the Marathon Bib Expo platform.

The product covers the **pre-race expo**: organizers load a participant roster and
distributors hand out bibs and goodies at the counter. Runners never self-register in
this app, and race day itself is out of scope.

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

| Build | `apiBaseUrl`                              | How it resolves                                                                    |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Dev   | `/api`                                    | Dev server proxies `/api/*` to `http://localhost:8080` via `proxy.conf.json`       |
| Prod  | `https://api.connectwithsandeepan.in/api` | App is served from `app.connectwithsandeepan.in` — different origin, **same site** |

Cookie auth requires the frontend and backend to stay **same-site**: that is what
lets the HttpOnly refresh cookie and the readable CSRF cookie work — in dev even
over plain HTTP from another device on the LAN, and in prod across the `app.` /
`api.` subdomains (the backend sets the cookie domain to `.connectwithsandeepan.in`).

**Never point `apiBaseUrl` at a genuinely cross-site URL** — a raw `*.amplifyapp.com`
host, or a LAN IP such as `http://192.168.0.106:8080/api` in dev — that breaks the
cookie auth model. To reach a backend on a different machine in dev, change the
`target` in `proxy.conf.json` instead.

The optional AI assistant talks to a **separate Python service** via
`environment.aiBaseUrl` (`/ai` prefix). It uses Bearer-token auth with no cookies, so
it may be cross-origin, and it is called directly rather than through the dev proxy so
its SSE stream arrives unbuffered.

### 3. Start the Development Server

```bash
npm start
```

The application starts at **http://localhost:4200** (bound to `0.0.0.0`, so you can
also open it from a phone on the same network at `http://<your-ip>:4200`).

---

## Tech Stack

| Layer             | Technology                                  |
| ----------------- | ------------------------------------------- |
| Language          | TypeScript 5.x                              |
| Framework         | Angular 21 (standalone, signals)            |
| Component Library | PrimeNG 21 (Aura preset, custom monochrome) |
| Styling           | Tailwind CSS 4.x + tailwindcss-primeui      |
| Forms             | Template-driven (`FormsModule` + `ngModel`) |
| HTTP              | Angular HttpClient + Interceptors           |
| Routing           | Angular Router (lazy-loaded)                |
| Charts            | Chart.js                                    |
| Animation         | GSAP + ScrollTrigger (landing page only)    |
| Offline / PWA     | Angular Service Worker                      |
| Testing           | Vitest 4.x (configured; no suite yet)       |
| Linting           | ESLint + Angular ESLint                     |
| Formatting        | Prettier                                    |
| Git Hooks         | Husky + lint-staged                         |
| Hosting           | AWS Amplify                                 |

---

## Architecture

All components are **standalone** — no NgModule pattern is used anywhere in the project. The codebase is organized by feature area; each feature owns its own routes, components, and services.

```
src/app/
├── core/          # Guards, interceptors, singleton services, domain models
├── layout/        # App shell: navbar, sidebar, AI assistant, command palette, theme
├── features/      # Lazy-loaded feature areas
│   ├── landing/             # public marketing page at '/' with a live cross-device QR demo
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

- **Role-Based Dashboards** — scope-aware views for ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER, and DISTRIBUTOR roles with statistics and theme-reactive charts
- **Event Management** — events with races, categories, participant limits, billing, a per-event dashboard, and SMS/WhatsApp/email template and campaign tabs
- **Participant Management** — CRUD, cursor-paginated tables with explicit "Load More", CSV import with a drag-to-map column wizard, import history, and export
- **Distribution** — bib/goodies handout with QR bib scanning, pending queues, and activity logs
- **Messaging Campaigns** — templates and campaigns driven by the sender provider's style: client-rendered providers author free message text, provider-rendered ones bind body variables to an approved template
- **Public Verification** — unauthenticated bib verification and downloadable expo cards (canvas-rendered) via short links
- **Landing Page** — public marketing page with a live cross-device QR demo and a footer chip that pulses real backend health
- **AI Assistant** — in-app conversational assistant with human-in-the-loop action approvals, streamed over SSE from a separate Python service
- **PWA / Offline** — installable app, cached shell, offline write guarding, and update prompts
- **Notifications** — navbar bell popover plus a full notification page
- **Audit Logs** — filterable audit trail with resolved user avatars and deep links
- **Responsive / Mobile** — mobile card lists, a bottom tab bar, and one app-wide breakpoint signal
- **Shared Table Base** — debounced search, pagination, persisted column/filter preferences, and skeleton loading via `BaseTableComponent`
- **Centralized Toasts & Errors** — one `ToastService` (de-duplication, intents, action toasts) and `ErrorHandlerService`, which surfaces the backend's message verbatim

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
npm run build      # Production build (outputs to dist/marathon-bib-expo-frontend/browser)
npm run watch      # Watch mode build
npm test           # Run Vitest (configured, but the project ships no test suite yet)
npm run lint       # Lint TypeScript and HTML files
npm run format     # Format all files with Prettier
```

### Scaffolding

```bash
# Generate a standalone component
ng generate component features/module-name/component-name --skip-tests --skip-import
```

---

## Deployment

The app is hosted on **AWS Amplify** at `app.connectwithsandeepan.in`, with the Spring
Boot API and the Python AI service behind `api.connectwithsandeepan.in` (`/api` and
`/ai`).

- **`amplify.yml`** — build spec. Artifacts are taken from
  `dist/marathon-bib-expo-frontend/browser` (Angular 21's `@angular/build` emits the
  browser bundle in a `browser/` subfolder).
- **`customHttp.yml`** — response headers. `index.html`, `ngsw.json`, `ngsw-worker.js`
  and `manifest.webmanifest` are served `no-cache` so PWA users can't get pinned to a
  stale build, while fingerprinted `*.js` / `*.css` are cached immutably. Also sets
  HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and
  `Permissions-Policy`.

> The `Permissions-Policy` header must keep `camera=(self)`. With an empty `camera=()`
> the browser rejects `getUserMedia` outright — no permission prompt — and the QR bib
> scanner stops working.

Because the SPA and the API are on different subdomains of the same site, the
production origin must stay under `connectwithsandeepan.in`; serving from the raw
`*.amplifyapp.com` URL is cross-site and breaks the refresh/CSRF cookies.

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
