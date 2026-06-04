import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CSRF_HEADER_NAME, getCsrfToken, isMutatingMethod } from '../utils/csrf.util';

const AUTH_PATH_LOGIN = '/auth/login';
const AUTH_PATH_REFRESH = '/auth/refresh';
const AUTH_PATH_LOGOUT = '/auth/logout';

// Module-level single-flight refresh state. Shared across all in-flight requests
// so a burst of concurrent 401s triggers exactly one /refresh call.
let refreshInFlight = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

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
  if (refreshInFlight) {
    return refreshedToken$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(attachToken(request, token))),
    );
  }

  refreshInFlight = true;
  refreshedToken$.next(null);

  return authService.refresh().pipe(
    switchMap((token) => {
      refreshInFlight = false;
      refreshedToken$.next(token);
      return next(attachToken(request, token));
    }),
    catchError((refreshError: HttpErrorResponse) => {
      refreshInFlight = false;
      refreshedToken$.next(null);
      authService.handleSessionInvalidated();
      router.navigate(['/login']);
      return throwError(() => refreshError);
    }),
  );
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
