import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CSRF_HEADER_NAME, getCsrfToken, isMutatingMethod } from '../utils/csrf.util';

const AUTH_PATH_LOGIN = '/auth/login';
const AUTH_PATH_REFRESH = '/auth/refresh';
const AUTH_PATH_LOGOUT = '/auth/logout';

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes(AUTH_PATH_LOGIN) ||
    url.includes(AUTH_PATH_REFRESH) ||
    url.includes(AUTH_PATH_LOGOUT)
  );
}

function attachToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  // Re-read the CSRF cookie too — /refresh may have rotated it, so the original
  // request's header would otherwise be stale and fail validation on retry.
  const csrfToken = isMutatingMethod(request.method) ? getCsrfToken() : null;
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
      ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
    },
  });
}

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        logError(error);
        return throwError(() => error);
      }

      // Auth endpoints (login/refresh/logout) handle their own 401s — never retry them.
      if (isAuthEndpoint(request.url)) {
        logError(error);
        return throwError(() => error);
      }

      // Terminal auth codes (evicted / locked / disabled): refreshing cannot help.
      // Tear down once and surface the backend's own message on the notice.
      const body = error.error as { code?: unknown; message?: unknown } | null;
      if (authService.isTerminalAuthCode(body?.code)) {
        authService.handleSessionInvalidated(
          typeof body?.message === 'string' && body.message ? body.message : undefined,
        );
        router.navigate(['/login']);
        return throwError(() => error);
      }

      return handle401(request, next, authService);
    }),
  );
};

// A burst of concurrent 401s shares one /refresh call (AuthService.refresh() is
// single-flight) and one eviction policy (refreshOrInvalidate ends the session on a
// genuine 401/403 only — transient failures never log the user out). Each waiting
// request then retries with the refreshed token; on refresh failure they all receive
// the same error and surface it through their own handlers.
function handle401(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
): Observable<HttpEvent<unknown>> {
  return authService
    .refreshOrInvalidate()
    .pipe(switchMap((token) => next(attachToken(request, token))));
}

function logError(error: HttpErrorResponse): void {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)['ng']) {
    console.error('HTTP Error:', {
      status: error.status,
      url: error.url,
      message: error.error?.message || 'HTTP Error',
      timestamp: new Date().toISOString(),
    });
  }
}
