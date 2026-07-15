import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, from, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { AuthResponse, LoginRequest, User, UserRole } from '../models/user.model';
import { BASE_URI } from '../../shared/constants/api.constant';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { LocalStorageService } from './local-storage.service';
import { ToastService } from './toast.service';

// Machine-readable 401 codes (backend AuthErrorCode) that end the session outright —
// refreshing cannot help, so the interceptor tears down immediately.
const TERMINAL_AUTH_CODES = ['SESSION_INVALIDATED', 'ACCOUNT_LOCKED', 'ACCOUNT_DISABLED'];

// On teardown several in-flight requests 401 at once, each firing an error toast.
// Swallow that burst briefly and show one notice instead.
const SESSION_TEARDOWN_QUIET_MS = 2500;

// Treat an access token with less than this much life left as already expired, so
// callers refresh *before* a send instead of racing an expiry mid-request. Sized to
// cover a multi-tool agent turn that runs for a minute or two after the send.
const TOKEN_EXPIRY_SKEW_MS = 120_000;

// The initializer blocks first paint, so cap how long the silent session restore may
// hold it — a dark/hanging backend must never blank the app (the public landing page
// especially). The restore itself keeps running in the background past this deadline.
const BOOTSTRAP_PAINT_DEADLINE_MS = 3_000;

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
  // server's `expiresInMs`; null when unknown. Drives isTokenExpiringSoon().
  private accessTokenExpiresAt: number | null = null;
  // Single-flight refresh shared across callers (the interceptor's 401 retry AND the
  // AI refresh-before-send) so two overlapping refreshes can't each rotate the
  // refresh cookie server-side and invalidate one another.
  private refreshInFlight$: Observable<string> | null = null;
  // Guards the one-shot session-eviction teardown so a burst of 401s can't run it
  // repeatedly; reset on the next successful authentication (setUserState).
  private sessionInvalidatedHandled = false;

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
   *
   * The initializer blocks first paint until this resolves, so visitors who have
   * never signed in (no SESSION_HINT — e.g. everyone on the public landing page)
   * resolve immediately instead of paying a refresh round trip that can only fail.
   */
  bootstrap(): Observable<void> {
    if (!this.storage.getString(STORAGE_KEYS.SESSION_HINT)) {
      return of(void 0);
    }
    // firstValueFrom (not the returned observable) drives the restore so it runs to
    // completion even after the paint deadline below releases the initializer —
    // cancelling a refresh mid-flight could lose the rotated refresh cookie.
    const restore = firstValueFrom(
      this.refresh().pipe(
        switchMap(() => this.fetchCurrentUser()),
        tap((user) => this.setUserState(user)),
        map(() => void 0),
        catchError((error: unknown) => {
          // Only a genuine refresh rejection means the session is dead. A dark
          // backend (network error, 5xx, hang) must not wipe storage — render
          // logged-out now and let the next load try the restore again.
          if (
            error instanceof HttpErrorResponse &&
            (error.status === 401 || error.status === 403)
          ) {
            this.clearLocalState();
          }
          return of(void 0);
        }),
      ),
    );
    const paintDeadline = new Promise<void>((resolve) =>
      setTimeout(resolve, BOOTSTRAP_PAINT_DEADLINE_MS),
    );
    return from(Promise.race([restore, paintDeadline]));
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
          // Surface the server's own reason (expiry / locked / disabled / evicted)
          // instead of always claiming a login on another device.
          this.handleSessionInvalidated(this.serverMessageOf(error));
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
   * POST /auth/logout — server ends the session and clears both auth cookies.
   * Driven by the refresh cookie + CSRF double-submit (the interceptor attaches
   * the header), so it works even with an expired/absent access token.
   * Always clears local state, even if the server call fails (e.g. network down).
   */
  logout(): Observable<void> {
    return this.http.post<void>(this.logoutUrl, {}, { withCredentials: true }).pipe(
      catchError(() => of(void 0)),
      finalize(() => this.clearLocalState()),
    );
  }

  /**
   * Called when the server reports the session is terminally dead — evicted by a
   * newer login, account locked/disabled, or a rejected refresh. Skips the server
   * logout call (the session is already gone). `detail` overrides the default
   * eviction text on the notice with the server's own message.
   */
  handleSessionInvalidated(detail?: string): void {
    // One eviction fans out into a burst of concurrent 401s (plus the interceptor
    // and refresh paths both landing here). Collapse them to a single teardown +
    // notice; re-armed on the next successful login (setUserState).
    if (this.sessionInvalidatedHandled) return;
    this.sessionInvalidatedHandled = true;
    this.clearLocalState();
    this.toast.suppressErrorsFor(SESSION_TEARDOWN_QUIET_MS);
    this.toast.clear();
    this.toast.emit('session-ended', { force: true, ...(detail ? { detail } : {}) });
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

  /** True when a 401 body carries a terminal auth code (evicted / locked / disabled). */
  isTerminalAuthCode(code: unknown): boolean {
    return typeof code === 'string' && TERMINAL_AUTH_CODES.includes(code);
  }

  /** Backend error-body message, when present (ErrorResponse.message). */
  private serverMessageOf(error: HttpErrorResponse): string | undefined {
    const message = (error.error as { message?: unknown } | null)?.message;
    return typeof message === 'string' && message ? message : undefined;
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
    // Track absolute expiry so we can refresh proactively (before a send) rather
    // than reactively (after a 401).
    this.accessTokenExpiresAt = res.expiresInMs > 0 ? Date.now() + res.expiresInMs : null;
  }

  private setUserState(user: User): void {
    this.currentUserSignal.set(user);
    this.isAuthenticatedSignal.set(true);
    // Lets the next bootstrap know a silent refresh is worth attempting; cleared
    // with the rest of storage in clearLocalState().
    this.storage.setString(STORAGE_KEYS.SESSION_HINT, '1');
    // A fresh session re-arms the one-shot eviction notice and clears any stale
    // cross-document dedupe marker, so a later eviction will surface again.
    this.sessionInvalidatedHandled = false;
    this.toast.resetIntent('session-ended');
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
