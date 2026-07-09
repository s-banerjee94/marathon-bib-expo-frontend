import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { CSRF_HEADER_NAME, getCsrfToken, isMutatingMethod } from '../utils/csrf.util';
import { AI_REQUEST, SKIP_AUTH } from './http-context-tokens';

/**
 * Adds withCredentials to every request (refresh-token + CSRF cookies are required
 * for the auth flow), attaches the in-memory access token when present, and echoes
 * the CSRF token header on every state-changing request (double-submit pattern).
 *
 * Requests flagged with the SKIP_AUTH context token are passed through untouched —
 * e.g. direct PUTs to S3 presigned URLs, which must not carry our auth/CSRF
 * headers or cookies.
 *
 * Requests flagged with AI_REQUEST go to the cross-origin AI service: they keep
 * the bearer token but drop cookies + CSRF, so the browser allows them under the
 * service's wildcard CORS (credentials can't be combined with `ACAO: *`).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_AUTH)) {
    return next(request);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();
  const aiRequest = request.context.get(AI_REQUEST);
  const csrfToken = !aiRequest && isMutatingMethod(request.method) ? getCsrfToken() : null;

  request = request.clone({
    withCredentials: !aiRequest,
    setHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
    },
  });

  return next(request);
};
