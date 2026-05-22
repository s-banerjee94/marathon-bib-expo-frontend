import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';

const PARTICIPANT_ROLES = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

export const PARTICIPANTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../participant-list/participant-list').then((m) => m.ParticipantList),
    canActivate: [roleGuard(PARTICIPANT_ROLES)],
    children: [
      {
        path: 'new',
        loadComponent: () =>
          import('../participant-form/participant-form').then((m) => m.ParticipantForm),
      },
      {
        path: ':eventId/:bib/edit',
        loadComponent: () =>
          import('../participant-form/participant-form').then((m) => m.ParticipantForm),
      },
    ],
  },
];
