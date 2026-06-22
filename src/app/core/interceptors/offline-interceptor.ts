import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { ConnectivityService } from '../services/connectivity.service';
import { isMutatingMethod } from '../utils/csrf.util';

/**
 * Blocks every state-changing request (POST/PUT/PATCH/DELETE) while the device is
 * offline — they would only fail at the network layer, and we don't queue writes.
 * Short-circuits with a clear offline error that the usual per-call error handlers
 * surface as a toast. Safe reads (GET/HEAD/OPTIONS) pass through to the cache.
 */
export const offlineInterceptor: HttpInterceptorFn = (request, next) => {
  const connectivity = inject(ConnectivityService);

  if (!connectivity.isOnline() && isMutatingMethod(request.method)) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 0,
          statusText: 'Offline',
          url: request.url,
          error: { message: "You're offline. This action needs an internet connection." },
        }),
    );
  }

  return next(request);
};
