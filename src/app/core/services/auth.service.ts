import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { AuthResponse, LoginRequest, User, UserRole } from '../models/user.model';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { BASE_URI } from '../../shared/constants/api.constant';
import { getCookie } from '../utils/cookie.util';

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const SESSION_INVALIDATED_MESSAGE = 'Session invalidated by another login. Please log in again.';

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

  // Emits whenever the in-memory access token is refreshed so SSE / other long-lived
  // connections can reconnect with the new bearer.
  private readonly tokenRefreshedSubject = new Subject<string>();
  readonly tokenRefreshed$ = this.tokenRefreshedSubject.asObservable();

  private readonly http = inject(HttpClient);
  private readonly authBase = `${BASE_URI}/auth`;
  private readonly loginUrl = `${this.authBase}/login`;
  private readonly refreshUrl = `${this.authBase}/refresh`;
  private readonly logoutUrl = `${this.authBase}/logout`;
  private readonly meUrl = `${BASE_URI}/users/me`;

  constructor() {
    // Drop any legacy token persisted by the previous in-localStorage scheme.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  }

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
   * access token (and rotates the refresh cookie server-side). Must echo the
   * CSRF token as a header.
   */
  refresh(): Observable<string> {
    return this.http
      .post<AuthResponse>(
        this.refreshUrl,
        {},
        {
          headers: this.csrfHeaders(),
          withCredentials: true,
        },
      )
      .pipe(
        tap((res) => {
          this.accessTokenSignal.set(res.accessToken);
          this.tokenRefreshedSubject.next(res.accessToken);
        }),
        switchMap((res) => of(res.accessToken)),
      );
  }

  // ============================================================================
  // Login / logout
  // ============================================================================

  login(request: LoginRequest): Observable<User> {
    this.loadingSignal.set(true);

    return this.http.post<AuthResponse>(this.loginUrl, request, { withCredentials: true }).pipe(
      tap((authResponse) => {
        this.accessTokenSignal.set(authResponse.accessToken);
        this.tokenRefreshedSubject.next(authResponse.accessToken);
      }),
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
    return this.http
      .post<void>(
        this.logoutUrl,
        {},
        {
          headers: this.csrfHeaders(),
          withCredentials: true,
        },
      )
      .pipe(
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
  }

  // ============================================================================
  // Queries
  // ============================================================================

  getCurrentRole(): UserRole | null {
    return this.currentUserSignal()?.role ?? null;
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

  /** True when a 401 carries the single-device eviction message. */
  isSessionInvalidatedMessage(message: unknown): boolean {
    return typeof message === 'string' && message === SESSION_INVALIDATED_MESSAGE;
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  getDashboardRoute(): string {
    const role = this.getCurrentRole();

    switch (role) {
      case UserRole.ROOT:
        return '/root-dashboard';
      case UserRole.ADMIN:
        return '/admin-dashboard';
      case UserRole.ORGANIZER_ADMIN:
        return '/org-admin-dashboard';
      case UserRole.ORGANIZER_USER:
        return '/org-user-dashboard';
      case UserRole.DISTRIBUTOR:
        return '/distributer-dashboard';
      default:
        return '/login';
    }
  }

  // ============================================================================
  // Internal helpers
  // ============================================================================

  private fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(this.meUrl, { withCredentials: true });
  }

  private setUserState(user: User): void {
    this.currentUserSignal.set(user);
    this.isAuthenticatedSignal.set(true);
  }

  private clearLocalState(): void {
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.accessTokenSignal.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  private csrfHeaders(): HttpHeaders {
    const token = getCookie(CSRF_COOKIE_NAME);
    return token ? new HttpHeaders({ [CSRF_HEADER_NAME]: token }) : new HttpHeaders();
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
