import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { pageTitle } from './shared/constants/app.constant';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: pageTitle('Login'),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: pageTitle('Dashboard'),
  },
  {
    path: 'organizations',
    loadChildren: () =>
      import('./features/organizations/organizations.routes').then((m) => m.ORGANIZATIONS_ROUTES),
  },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'events',
    loadChildren: () => import('./features/events/events.routes').then((m) => m.EVENTS_ROUTES),
  },
  {
    path: 'participants',
    loadChildren: () =>
      import('./features/participants/participants.routes').then((m) => m.PARTICIPANTS_ROUTES),
  },
  {
    path: 'distribution',
    loadChildren: () =>
      import('./features/distribution/distribution.routes').then((m) => m.DISTRIBUTION_ROUTES),
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/unauthorized/unauthorized').then((m) => m.Unauthorized),
    title: pageTitle('Unauthorized'),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
    title: pageTitle('Not Found'),
  },
];
