import { HttpContextToken } from '@angular/common/http';

/**
 * Marks a request that must bypass `authInterceptor` entirely — no Authorization
 * header, no CSRF header, no `withCredentials`. Used for direct uploads to S3
 * presigned URLs, where our bearer/cookies would break the request signature and
 * trigger needless cross-origin credential handling.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/**
 * Marks a request to the Python AI agent service (a separate origin with
 * Bearer-only auth). `authInterceptor` still attaches the Authorization header,
 * but sends NO cookies (`withCredentials: false`) and NO CSRF header: the AI
 * service verifies the bearer token and needs neither, and a credential-less
 * request is what works under its wildcard CORS (an `Access-Control-Allow-Origin: *`
 * response is rejected by the browser when the request carries credentials).
 */
export const AI_REQUEST = new HttpContextToken<boolean>(() => false);
