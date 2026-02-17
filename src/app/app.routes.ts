import { Routes } from '@angular/router';
import {
  adminGuard,
  distributorGuard,
  orgUserGuard,
  rootGuard,
  rootOrAdminGuard,
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
    path: 'organization-form',
    loadComponent: () =>
      import('./features/organization-form/organization-form').then((m) => m.OrganizationForm),
    canActivate: [rootOrAdminGuard],
  },
  {
    path: 'organization-form/:id',
    loadComponent: () =>
      import('./features/organization-form/organization-form').then((m) => m.OrganizationForm),
    canActivate: [rootOrAdminGuard],
  },
  {
    path: 'organizations',
    loadComponent: () =>
      import('./features/organization-list/organization-list').then((m) => m.OrganizationList),
    canActivate: [rootOrAdminGuard],
  },
  {
    path: 'users',
    loadComponent: () => import('./features/user-list/user-list').then((m) => m.UserList),
    canActivate: [rootOrAdminGuard],
  },
  {
    path: 'user-form',
    loadComponent: () => import('./features/user-form/user-form').then((m) => m.UserForm),
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
    path: 'events',
    loadComponent: () => import('./features/event-list/event-list').then((m) => m.EventList),
    canActivate: [userCreationGuard], // ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER
  },
  {
    path: 'event-form',
    loadComponent: () => import('./features/event-form/event-form').then((m) => m.EventForm),
    canActivate: [userCreationGuard], // ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER
  },
  {
    path: 'event-form/:id',
    loadComponent: () => import('./features/event-form/event-form').then((m) => m.EventForm),
    canActivate: [userCreationGuard], // ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER
  },
  {
    path: 'events/:id/details',
    loadComponent: () =>
      import('./features/event-details/event-details/event-details').then((m) => m.EventDetails),
    canActivate: [userCreationGuard], // ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER
  },
  {
    path: 'participants',
    loadComponent: () =>
      import('./features/participant-list/participant-list').then((m) => m.ParticipantList),
    canActivate: [userCreationGuard], // ROOT, ADMIN, ORGANIZER_ADMIN, ORGANIZER_USER
  },
  {
    path: 'participant-form',
    loadComponent: () =>
      import('./features/participant-form/participant-form').then((m) => m.ParticipantForm),
    canActivate: [userCreationGuard], // ORGANIZER_ADMIN, ORGANIZER_USER, ADMIN, ROOT
  },
  {
    path: 'participant-form/:eventId/:bibNumber',
    loadComponent: () =>
      import('./features/participant-form/participant-form').then((m) => m.ParticipantForm),
    canActivate: [userCreationGuard], // ORGANIZER_ADMIN, ORGANIZER_USER, ADMIN, ROOT
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
