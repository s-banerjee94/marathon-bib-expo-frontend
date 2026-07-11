import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DemoSessionResponse,
  DemoSessionStatusResponse,
} from '../../core/models/demo-session.model';
import { SKIP_AUTH } from '../../core/interceptors/http-context-tokens';
import { BASE_URI } from '../../shared/constants/api.constant';

/**
 * Landing-page live QR demo sessions. The whole surface is public and
 * anonymous — SKIP_AUTH keeps the bearer token and CSRF header off these
 * requests even when a logged-in user is viewing the landing page.
 */
@Injectable({
  providedIn: 'root',
})
export class DemoSessionService {
  private http = inject(HttpClient);

  private readonly baseUrl = `${BASE_URI}/public/demo/sessions`;
  private readonly context = new HttpContext().set(SKIP_AUTH, true);

  createSession(): Observable<DemoSessionResponse> {
    return this.http.post<DemoSessionResponse>(this.baseUrl, null, { context: this.context });
  }

  getSession(code: string): Observable<DemoSessionResponse> {
    return this.http.get<DemoSessionResponse>(`${this.baseUrl}/${code}`, {
      context: this.context,
    });
  }

  collect(code: string): Observable<DemoSessionStatusResponse> {
    return this.http.post<DemoSessionStatusResponse>(`${this.baseUrl}/${code}/collect`, null, {
      context: this.context,
    });
  }

  /** Fallback short-poll — the SSE stream below is the primary channel. */
  getStatus(code: string): Observable<DemoSessionStatusResponse> {
    return this.http.get<DemoSessionStatusResponse>(`${this.baseUrl}/${code}/status`, {
      context: this.context,
    });
  }

  /**
   * URL of the session's `text/event-stream` endpoint, for EventSource (which
   * bypasses HttpClient and the interceptors — fine here, the surface is
   * public). Emits `status` events with a DemoSessionStatusResponse payload:
   * current state on connect, then live updates; closes after COLLECTED.
   */
  streamUrl(code: string): string {
    return `${this.baseUrl}/${code}/events`;
  }
}
