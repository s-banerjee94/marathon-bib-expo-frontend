import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, finalize } from 'rxjs/operators';
import { User, UserRole, AuthResponse, LoginRequest } from '../models/user.model';

/**
 * Authentication Service
 * Manages user authentication state using Angular signals
 * Stores current user and authentication token
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSignal = signal<User | null>(this.loadUserFromStorage());
  private isAuthenticatedSignal = signal<boolean>(!!this.loadUserFromStorage());
  private loadingSignal = signal<boolean>(false);

  currentUser = this.currentUserSignal.asReadonly();
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  isLoading = this.loadingSignal.asReadonly();

  private readonly tokenKey = 'marathon_auth_token';
  private readonly userKey = 'marathon_user';
  private readonly http = inject(HttpClient);
  private readonly authUrl = '/api/auth/login';

  constructor() {
    this.restoreSessionFromStorage();
  }

  /**
   * Login method - connects to backend API using RxJS
   * Returns Observable for reactive handling
   */
  login(request: LoginRequest): Observable<AuthResponse> {
    this.loadingSignal.set(true);

    return this.http.post<AuthResponse>(this.authUrl, request).pipe(
      tap((authResponse) => this.setAuthState(authResponse)),
      catchError((error) => this.handleLoginError(error)),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  /**
   * Handle login errors with specific messages
   */
  private handleLoginError(error: unknown): Observable<never> {
    let errorMessage: string;

    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        errorMessage = 'Invalid username or password';
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

  /**
   * Logout - clear user state and storage
   */
  logout(): void {
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * Get current user role
   */
  getCurrentRole(): UserRole | null {
    return this.currentUserSignal()?.role ?? null;
  }

  /**
   * Check if current user has a specific role
   */
  hasRole(role: UserRole): boolean {
    return this.currentUserSignal()?.role === role;
  }

  /**
   * Check if current user has any of the provided roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const userRole = this.getCurrentRole();
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Get authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Private helper: Set authentication state
   */
  private setAuthState(response: AuthResponse): void {
    // Transform AuthResponse to User object
    const user: User = {
      id: response.id,
      username: response.username,
      email: '', // Not provided in login response
      fullName: response.username,
      phoneNumber: '',
      role: response.role as UserRole,
      organizationId: response.organizationId,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.currentUserSignal.set(user);
    this.isAuthenticatedSignal.set(true);
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  /**
   * Private helper: Load user from localStorage
   */
  private loadUserFromStorage(): User | null {
    const userJson = localStorage.getItem(this.userKey);
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Private helper: Restore session from storage on app load
   */
  private restoreSessionFromStorage(): void {
    const user = this.loadUserFromStorage();
    const token = localStorage.getItem(this.tokenKey);

    if (user && token) {
      this.currentUserSignal.set(user);
      this.isAuthenticatedSignal.set(true);
    }
  }
}
