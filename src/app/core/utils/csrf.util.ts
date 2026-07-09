import { getCookie } from './cookie.util';

// Double-submit CSRF: the backend sets a readable `csrfToken` cookie at login and
// expects the same value echoed back in the `X-CSRF-Token` header on every
// state-changing request.
export const CSRF_COOKIE_NAME = 'csrfToken';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** True for methods the backend treats as state-changing (everything except GET/HEAD/OPTIONS). */
export function isMutatingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/** Current CSRF token from the cookie, or null when not yet issued. */
export function getCsrfToken(): string | null {
  return getCookie(CSRF_COOKIE_NAME);
}
