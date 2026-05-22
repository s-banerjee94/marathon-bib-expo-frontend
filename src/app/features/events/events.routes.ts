import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

const EVENT_ROLES = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

export const EVENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../event-list/event-list').then((m) => m.EventList),
    canActivate: [roleGuard(EVENT_ROLES)],
    title: pageTitle('Events'),
    children: [
      {
        path: 'new',
        loadComponent: () => import('../event-form/event-form').then((m) => m.EventForm),
        title: pageTitle('New Event'),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('../event-form/event-form').then((m) => m.EventForm),
        title: pageTitle('Edit Event'),
      },
    ],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('../event-details/event-details/event-details').then((m) => m.EventDetails),
    canActivate: [roleGuard(EVENT_ROLES)],
    title: pageTitle('Event Details'),
  },
];
