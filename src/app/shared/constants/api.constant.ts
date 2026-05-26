import { environment } from '../../../environments/environment';

// Resolved at build time from environment.ts (dev) or environment.prod.ts (prod) via angular.json fileReplacements.
export const BASE_URI = environment.apiBaseUrl;

// Host root, outside the `/api` prefix. Public (no-auth) endpoints live here,
// e.g. the participant verification short link: GET /s/{shortCode}.
export const PUBLIC_BASE_URI = BASE_URI.replace(/\/api\/?$/, '');
