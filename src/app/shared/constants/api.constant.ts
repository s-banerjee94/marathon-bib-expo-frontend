import { environment } from '../../../environments/environment';

// Resolved at build time from environment.ts (dev) or environment.prod.ts (prod) via angular.json fileReplacements.
export const BASE_URI = environment.apiBaseUrl;
