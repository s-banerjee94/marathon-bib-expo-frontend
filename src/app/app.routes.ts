import { Routes } from '@angular/router';
import {
  rootGuard,
  adminGuard,
  rootOrAdminGuard,
  orgUserGuard,
  distributorGuard,
  userCreationGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'root-dashboard',
    loadComponent: () =>
      import('./features/root-dashboard/root-dashboard').then((m) => m.RootDashboard),
    canActivate: [rootGuard],
  },
  {
    path: 'admin-dashboard',
    loadComponent: () =>
      import('./features/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
    canActivate: [adminGuard],
  },
  {
    path: 'manage-organization',
    loadComponent: () =>
      import('./features/manage-organization/manage-organization').then(
        (m) => m.ManageOrganization,
      ),
    canActivate: [rootOrAdminGuard],
  },
  {
    path: 'manage-organization/:id',
    loadComponent: () =>
      import('./features/manage-organization/manage-organization').then(
        (m) => m.ManageOrganization,
      ),
    canActivate: [rootOrAdminGuard],
  },
  {
    path: 'manage-user',
    loadComponent: () => import('./features/manage-user/manage-user').then((m) => m.ManageUser),
    canActivate: [userCreationGuard],
  },
  {
    path: 'organizer-dashboard',
    loadComponent: () =>
      import('./features/organizer-dashboard/organizer-dashboard').then(
        (m) => m.OrganizerDashboard,
      ),
    canActivate: [orgUserGuard], // Both ORGANIZER_ADMIN and ORGANIZER_USER can access
  },
  {
    path: 'distributer-dashboard',
    loadComponent: () =>
      import('./features/distributer-dashboard/distributer-dashboard').then(
        (m) => m.DistributerDashboard,
      ),
    canActivate: [distributorGuard],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },
  {
    path: '**',
    redirectTo: '/root-dashboard',
  },
];
