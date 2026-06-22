import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CSRF_HEADER_NAME, getCsrfToken, isMutatingMethod } from '../utils/csrf.util';

const AUTH_PATH_LOGIN = '/auth/login';
const AUTH_PATH_REFRESH = '/auth/refresh';
const AUTH_PATH_LOGOUT = '/auth/logout';

// Module-level single-flight refresh: a burst of concurrent 401s shares exactly one
// /refresh call (and its outcome — token or error) via this replayed observable.
let refresh$: Observable<string> | null = null;

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

      // Single-device eviction: backend reports the session was killed by a newer
      // login. Don't try to refresh — that token is dead. Clear state, send to login.
      const message = (error.error as { message?: unknown } | null)?.message;
      if (authService.isSessionInvalidatedMessage(message)) {
        authService.handleSessionInvalidated();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      return handle401(request, next, authService, router);
    }),
  );
};

function handle401(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  // First 401 of a burst kicks off the shared refresh; concurrent ones reuse it.
  refresh$ ??= authService.refresh().pipe(
    catchError((refreshError: HttpErrorResponse) => {
      // End the session ONLY when the backend genuinely rejects the refresh token
      // (401/403). Network errors (status 0), timeouts, and server errors (5xx) must
      // NOT log the user out — a transient blip should never evict a valid session.
      if (refreshError.status === 401 || refreshError.status === 403) {
        authService.handleSessionInvalidated();
        router.navigate(['/login']);
      }
      return throwError(() => refreshError);
    }),
    finalize(() => {
      refresh$ = null;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Each waiting request retries with the refreshed token; on refresh failure they all
  // receive the same error (no hang) and surface it through their own handlers.
  return refresh$.pipe(switchMap((token) => next(attachToken(request, token))));
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
