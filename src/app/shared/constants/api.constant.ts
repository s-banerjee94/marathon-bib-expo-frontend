import { environment } from '../../../environments/environment';

// Resolved at build time from environment.ts (dev) or environment.prod.ts (prod) via angular.json fileReplacements.
export const BASE_URI = environment.apiBaseUrl;

// The AI agent service (Python FastAPI) is a SEPARATE service from the Java API:
// its routes are /chat, /chat/resume, /chat/stream, /chat/history, /chat/usage,
// /chat/memory — NOT under the `/api` Java prefix. It uses Bearer-token auth (no
// cookies), so its base can be an absolute cross-origin URL: in dev we hit it
// directly at :8000 (bypassing the dev proxy so SSE isn't buffered); in prod it
// is the same-origin host root. Sourced from environment.aiBaseUrl.
export const AI_BASE_URI = environment.aiBaseUrl;
