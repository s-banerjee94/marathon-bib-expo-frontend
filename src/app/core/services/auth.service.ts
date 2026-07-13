import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AuthResponse, LoginRequest, User, UserRole } from '../models/user.model';
import { BASE_URI } from '../../shared/constants/api.constant';
import { LocalStorageService } from './local-storage.service';
import { ToastService } from './toast.service';

const SESSION_INVALIDATED_MESSAGE = 'Session invalidated by another login. Please log in again.';

// On teardown several in-flight requests 401 at once, each firing an error toast.
// Swallow that burst briefly and show one notice instead.
const SESSION_TEARDOWN_QUIET_MS = 2500;

// Treat an access token with less than this much life left as already expired, so
// callers refresh *before* a send instead of racing an expiry mid-request. Sized to
// cover a multi-tool agent turn that runs for a minute or two after the send.
const TOKEN_EXPIRY_SKEW_MS = 120_000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSignal = signal<User | null>(null);
  currentUser = this.currentUserSignal.asReadonly();
  private isAuthenticatedSignal = signal<boolean>(false);
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  private loadingSignal = signal<boolean>(false);
  isLoading = this.loadingSignal.asReadonly();

  private accessTokenSignal = signal<string | null>(null);
  // Absolute expiry (ms epoch) of the in-memory access token, derived from the
  // server's `expiresIn`; null when unknown. Drives isTokenExpiringSoon().
  private accessTokenExpiresAt: number | null = null;
  // Single-flight refresh shared across callers (the interceptor's 401 retry AND the
  // AI refresh-before-send) so two overlapping refreshes can't each rotate the
  // refresh cookie server-side and invalidate one another.
  private refreshInFlight$: Observable<string> | null = null;

  private readonly http = inject(HttpClient);
  private readonly storage = inject(LocalStorageService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly authBase = `${BASE_URI}/auth`;
  private readonly loginUrl = `${this.authBase}/login`;
  private readonly refreshUrl = `${this.authBase}/refresh`;
  private readonly logoutUrl = `${this.authBase}/logout`;
  private readonly meUrl = `${BASE_URI}/users/me`;

  // Legacy localStorage tokens (from a prior in-localStorage auth scheme) are
  // wiped on logout via LocalStorageService.clear(); no constructor cleanup needed.

  // ============================================================================
  // Bootstrap / refresh
  // ============================================================================

  /**
   * Called once at app startup (APP_INITIALIZER). Tries to silently recover the
   * session from the refresh-token cookie. Never rejects — failure simply leaves
   * the app in an unauthenticated state.
   */
  bootstrap(): Observable<void> {
    return this.refresh().pipe(
      switchMap(() => this.fetchCurrentUser()),
      tap((user) => this.setUserState(user)),
      switchMap(() => of(void 0)),
      catchError(() => {
        this.clearLocalState();
        return of(void 0);
      }),
    );
  }

  /**
   * POST /auth/refresh — exchanges the HttpOnly refresh-token cookie for a new
   * access token (and rotates the refresh cookie server-side). The CSRF header is
   * attached by authInterceptor (all mutating requests carry it).
   */
  refresh(): Observable<string> {
    // Single-flight: concurrent callers share ONE /refresh call (and its result). The
    // in-flight observable is dropped on completion so the next refresh starts fresh.
    this.refreshInFlight$ ??= this.http
      .post<AuthResponse>(this.refreshUrl, {}, { withCredentials: true })
      .pipe(
        tap((res) => this.applyAccessToken(res)),
        map((res) => res.accessToken),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    return this.refreshInFlight$;
  }

  /**
   * Refresh, ending the session when the backend genuinely rejects the refresh
   * token (401/403): clear local state and route to login. Transient failures
   * (network / 5xx / timeout) pass through unchanged so callers can retry — they
   * must never evict a valid session. The one session-eviction policy shared by
   * the error interceptor's 401 retry and the AI assistant's refresh-before-send.
   */
  refreshOrInvalidate(): Observable<string> {
    return this.refresh().pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.handleSessionInvalidated();
          void this.router.navigate(['/login']);
        }
        return throwError(() => error);
      }),
    );
  }

  // ============================================================================
  // Login / logout
  // ============================================================================

  login(request: LoginRequest): Observable<User> {
    this.loadingSignal.set(true);

    return this.http.post<AuthResponse>(this.loginUrl, request, { withCredentials: true }).pipe(
      tap((authResponse) => this.applyAccessToken(authResponse)),
      switchMap(() => this.fetchCurrentUser()),
      tap((user) => this.setUserState(user)),
      catchError((error) => this.handleLoginError(error)),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  /**
   * POST /auth/logout — server ends the session and closes any SSE streams.
   * Always clears local state, even if the server call fails (e.g. network down).
   */
  logout(): Observable<void> {
    return this.http.post<void>(this.logoutUrl, {}, { withCredentials: true }).pipe(
      catchError(() => of(void 0)),
      finalize(() => this.clearLocalState()),
    );
  }

  /**
   * Called by the error interceptor when the server reports the session was
   * invalidated by a login on another device. Skips the server logout call
   * (the session is already gone).
   */
  handleSessionInvalidated(): void {
    this.clearLocalState();
    // Replace the 401 burst with a single notice.
    this.toast.suppressErrorsFor(SESSION_TEARDOWN_QUIET_MS);
    this.toast.clear();
    this.toast.emit('session-ended', { force: true });
  }

  // ============================================================================
  // Queries
  // ============================================================================

  getCurrentRole(): UserRole | null {
    return this.currentUserSignal()?.role ?? null;
  }

  /**
   * Merge fields into the cached current user (e.g. after a profile-picture
   * change) so signals like the navbar avatar update immediately. No-op when not
   * logged in.
   */
  updateCurrentUser(patch: Partial<User>): void {
    const current = this.currentUserSignal();
    if (current) {
      this.currentUserSignal.set({ ...current, ...patch });
    }
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserSignal()?.role === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const userRole = this.getCurrentRole();
    return userRole ? roles.includes(userRole) : false;
  }

  /** In-memory access token (null until login / refresh succeeds). */
  getToken(): string | null {
    return this.accessTokenSignal();
  }

  /**
   * True when the access token is missing, its expiry is unknown, or it will lapse
   * within the skew window. The AI assistant refreshes before a send when this is
   * true: its raw-fetch stream forwards the token to the MCP server per tool call
   * and bypasses the HTTP interceptors, so it can't rely on the reactive 401-retry.
   */
  isTokenExpiringSoon(): boolean {
    if (!this.accessTokenSignal() || this.accessTokenExpiresAt === null) return true;
    return this.accessTokenExpiresAt - Date.now() <= TOKEN_EXPIRY_SKEW_MS;
  }

  /** True when a 401 carries the single-device eviction message. */
  isSessionInvalidatedMessage(message: unknown): boolean {
    return typeof message === 'string' && message === SESSION_INVALIDATED_MESSAGE;
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  getDashboardRoute(): string {
    return this.getCurrentRole() ? '/dashboard' : '/login';
  }

  // ============================================================================
  // Internal helpers
  // ============================================================================

  private fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(this.meUrl, { withCredentials: true });
  }

  private applyAccessToken(res: AuthResponse): void {
    this.accessTokenSignal.set(res.accessToken);
    // The server hands us the lifetime in seconds — track absolute expiry so we can
    // refresh proactively (before a send) rather than reactively (after a 401).
    this.accessTokenExpiresAt = res.expiresIn > 0 ? Date.now() + res.expiresIn * 1000 : null;
  }

  private setUserState(user: User): void {
    this.currentUserSignal.set(user);
    this.isAuthenticatedSignal.set(true);
  }

  private clearLocalState(): void {
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.accessTokenSignal.set(null);
    this.accessTokenExpiresAt = null;
    // Wipe ALL persisted state on logout — theme, table prefs, in-flight imports,
    // legacy tokens. The next session starts from defaults.
    this.storage.clear();
  }

  private handleLoginError(error: unknown): Observable<never> {
    let errorMessage: string;

    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        errorMessage = error.error?.message || 'Invalid username or password';
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else {
        errorMessage = error.error?.message || 'Login failed. Please try again.';
      }
    } else {
      errorMessage = 'An unexpected error occurred. Please try again.';
    }

    return throwError(() => new Error(errorMessage));
  }
}
