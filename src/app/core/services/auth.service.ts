import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, finalize, switchMap } from 'rxjs/operators';
import { User, UserRole, AuthResponse, LoginRequest } from '../models/user.model';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';

/**
 * Authentication Service
 * Manages user authentication state using Angular signals
 * Stores current user and authentication token
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Signals
  private currentUserSignal = signal<User | null>(this.loadUserFromStorage());
  private isAuthenticatedSignal = signal<boolean>(!!this.loadUserFromStorage());
  private loadingSignal = signal<boolean>(false);

  // Public readonly signals
  currentUser = this.currentUserSignal.asReadonly();
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  isLoading = this.loadingSignal.asReadonly();

  // Dependencies
  private readonly tokenKey = STORAGE_KEYS.AUTH_TOKEN;
  private readonly userKey = STORAGE_KEYS.USER;
  private readonly http = inject(HttpClient);
  private readonly authUrl = '/api/auth/login';

  constructor() {
    this.restoreSessionFromStorage();
  }

  // ============================================================================
  // Core Authentication Methods
  // ============================================================================

  /**
   * Login method - connects to backend API using RxJS
   * 1. POST to /api/auth/login - returns token
   * 2. Store auth token in localStorage
   * 3. GET /api/users/me - fetch complete user details
   * 4. Store complete user data and set authenticated state
   */
  login(request: LoginRequest): Observable<User> {
    this.loadingSignal.set(true);

    return this.http.post<AuthResponse>(this.authUrl, request).pipe(
      tap((authResponse) => this.storeAuthToken(authResponse.token)),
      switchMap(() => this.fetchCurrentUser()),
      tap((user) => this.setUserState(user)),
      catchError((error) => this.handleLoginError(error)),
      finalize(() => this.loadingSignal.set(false)),
    );
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

  // ============================================================================
  // User Query Methods
  // ============================================================================

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

  // ============================================================================
  // Navigation Methods
  // ============================================================================

  /**
   * Get dashboard route based on user role
   */
  getDashboardRoute(): string {
    const role = this.getCurrentRole();

    switch (role) {
      case UserRole.ROOT:
        return '/root-dashboard';
      case UserRole.ADMIN:
        return '/admin-dashboard';
      case UserRole.ORGANIZER_ADMIN:
        return '/organizer-dashboard';
      case UserRole.ORGANIZER_USER:
        return '/organizer-dashboard';
      case UserRole.DISTRIBUTOR:
        return '/distributer-dashboard';
      default:
        return '/login';
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Store authentication token from login response
   * This token will be used for subsequent API requests
   */
  private storeAuthToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Fetch complete user details from /me endpoint
   * This is called after successful login to get full user data
   */
  private fetchCurrentUser(): Observable<User> {
    return this.http.get<User>('/api/users/me');
  }

  /**
   * Set user state after successful /me call
   * Stores complete user data in signal and localStorage
   * Sets authenticated flag to true
   */
  private setUserState(user: User): void {
    this.currentUserSignal.set(user);
    this.isAuthenticatedSignal.set(true);
    localStorage.setItem(this.userKey, JSON.stringify(user));
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
   * Load user from localStorage
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
   * Restore session from storage on app load
   * Restores both auth token and user data if available
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
