import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { CSRF_HEADER_NAME, getCsrfToken, isMutatingMethod } from '../utils/csrf.util';

/**
 * Adds withCredentials to every request (refresh-token + CSRF cookies are required
 * for the auth flow), attaches the in-memory access token when present, and echoes
 * the CSRF token header on every state-changing request (double-submit pattern).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const csrfToken = isMutatingMethod(request.method) ? getCsrfToken() : null;

  request = request.clone({
    withCredentials: true,
    setHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
    },
  });

  return next(request);
};
