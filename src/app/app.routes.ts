import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { UserRole } from './core/models/user.model';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
  },
  {
    path: 'organization-form',
    loadComponent: () =>
      import('./features/organization-form/organization-form').then((m) => m.OrganizationForm),
    canActivate: [roleGuard([UserRole.ROOT, UserRole.ADMIN])],
  },
  {
    path: 'organization-form/:id',
    loadComponent: () =>
      import('./features/organization-form/organization-form').then((m) => m.OrganizationForm),
    canActivate: [roleGuard([UserRole.ROOT, UserRole.ADMIN])],
  },
  {
    path: 'organizations',
    loadComponent: () =>
      import('./features/organization-list/organization-list').then((m) => m.OrganizationList),
    canActivate: [roleGuard([UserRole.ROOT, UserRole.ADMIN])],
  },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'events',
    loadComponent: () => import('./features/event-list/event-list').then((m) => m.EventList),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'event-form',
    loadComponent: () => import('./features/event-form/event-form').then((m) => m.EventForm),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'event-form/:id',
    loadComponent: () => import('./features/event-form/event-form').then((m) => m.EventForm),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'events/:id/details',
    loadComponent: () =>
      import('./features/event-details/event-details/event-details').then((m) => m.EventDetails),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'participants',
    loadComponent: () =>
      import('./features/participant-list/participant-list').then((m) => m.ParticipantList),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'participant-form',
    loadComponent: () =>
      import('./features/participant-form/participant-form').then((m) => m.ParticipantForm),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'participant-form/:eventId/:bibNumber',
    loadComponent: () =>
      import('./features/participant-form/participant-form').then((m) => m.ParticipantForm),
    canActivate: [
      roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER]),
    ],
  },
  {
    path: 'distribution',
    loadComponent: () =>
      import('./features/manage-distribution/manage-distribution').then(
        (m) => m.ManageDistribution,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
