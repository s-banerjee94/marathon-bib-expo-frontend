import { HttpContextToken } from '@angular/common/http';

/**
 * Marks a request that must bypass `authInterceptor` entirely — no Authorization
 * header, no CSRF header, no `withCredentials`. Used for direct uploads to S3
 * presigned URLs, where our bearer/cookies would break the request signature and
 * trigger needless cross-origin credential handling.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
