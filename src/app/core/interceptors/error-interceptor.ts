import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

/**
 * Functional HTTP Interceptor for Error Handling
 * Handles global error scenarios:
 * - 401 Unauthorized: Redirects to login (token expired)
 * - Development logging: Logs all errors to console
 * - Error pass-through: Allows components to handle errors
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401: Token expired or invalid, redirect to login
      if (error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }

      // Log errors in development mode
      if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)['ng']) {
        // Development environment detected via Angular debug info
        console.error('HTTP Error:', {
          status: error.status,
          url: error.url,
          message: error.error?.message || 'HTTP Error',
          timestamp: new Date().toISOString(),
        });
      }

      // Re-throw error to allow component-level handling
      return throwError(() => error);
    }),
  );
};
