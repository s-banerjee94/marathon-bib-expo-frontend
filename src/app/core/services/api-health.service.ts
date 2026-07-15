import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { SKIP_AUTH } from '../interceptors/http-context-tokens';
import { BASE_URI } from '../../shared/constants/api.constant';

/** A pulse that hasn't answered in this long counts as "backend dark". */
const PULSE_TIMEOUT_MS = 5_000;

/**
 * Cheap "is the backend alive?" pulse, public and anonymous (SKIP_AUTH). The API
 * exposes no dedicated health endpoint, so it probes a public demo-status lookup
 * with a code that can't exist: any HTTP answer — including its 404 — proves the
 * API is up, while a network error, a 5xx (nginx with the app dark), or a hang
 * means it isn't.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiHealthService {
  private readonly http = inject(HttpClient);

  private readonly pulseUrl = `${BASE_URI}/public/demo/sessions/status-pulse/status`;
  private readonly context = new HttpContext().set(SKIP_AUTH, true);

  /** Emits exactly once — true (alive) or false (dark). Never errors. */
  pulse(): Observable<boolean> {
    return this.http.get(this.pulseUrl, { context: this.context }).pipe(
      map(() => true),
      timeout(PULSE_TIMEOUT_MS),
      catchError((error: unknown) =>
        of(error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500),
      ),
    );
  }
}
