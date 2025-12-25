import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Auth Guard: Verify user is authenticated
 * Redirects to login if not authenticated
 */
export const authGuard: CanActivateFn = (route, state) => {
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
 */
export const rootGuard: CanActivateFn = (route, state) => {
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
 * Admin Guard: ADMIN and ROOT users can access
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasAnyRole([UserRole.ADMIN, UserRole.ROOT])) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Org Admin Guard: ORGANIZER_ADMIN, ADMIN, and ROOT users can access
 */
export const orgAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasAnyRole([UserRole.ORGANIZER_ADMIN, UserRole.ADMIN, UserRole.ROOT])) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Org User Guard: ORGANIZER_USER and above can access
 */
export const orgUserGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (
    authService.hasAnyRole([
      UserRole.ORGANIZER_USER,
      UserRole.ORGANIZER_ADMIN,
      UserRole.ADMIN,
      UserRole.ROOT,
    ])
  ) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

/**
 * Distributor Guard: All authenticated users can access
 */
export const distributorGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
