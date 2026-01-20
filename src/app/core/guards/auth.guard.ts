import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Auth Guard: Verify user is authenticated
 * Redirects to login if not authenticated
 */
export const authGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

/**
 * Root Guard: Only ROOT users can access
 * Used for: /root-dashboard
 */
export const rootGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasRole(UserRole.ROOT)) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Admin Guard: Only ADMIN users can access
 * Used for: /admin-dashboard
 */
export const adminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasRole(UserRole.ADMIN)) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Root or Admin Guard: ROOT and ADMIN users can access
 * Used for: /manage-organization (both ROOT and ADMIN can manage organizations)
 */
export const rootOrAdminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN])) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Org Admin Guard: Only ORGANIZER_ADMIN and ADMIN users can access
 * Used for: Organizer admin features
 */
export const orgAdminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasAnyRole([UserRole.ORGANIZER_ADMIN, UserRole.ADMIN])) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Org User Guard: ORGANIZER_USER, ORGANIZER_ADMIN, and ADMIN users can access
 * Used for: /organizer-dashboard
 */
export const orgUserGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasAnyRole([UserRole.ORGANIZER_USER, UserRole.ORGANIZER_ADMIN, UserRole.ADMIN])) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Distributor Guard: Only DISTRIBUTOR users can access
 * Used for: /distributer-dashboard
 */
export const distributorGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasRole(UserRole.DISTRIBUTOR)) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * User Creation Guard: ROOT, ADMIN, ORGANIZER_ADMIN, and ORGANIZER_USER can access
 * Used for: /manage-user
 */
export const userCreationGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (
    authService.hasAnyRole([
      UserRole.ROOT,
      UserRole.ADMIN,
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ])
  ) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};
