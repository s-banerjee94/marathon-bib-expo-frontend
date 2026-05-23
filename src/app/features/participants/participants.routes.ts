import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

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
      import('./participant-list/participant-list').then((m) => m.ParticipantList),
    canActivate: [roleGuard(PARTICIPANT_ROLES)],
    title: pageTitle('Participants'),
    children: [
      {
        path: 'event/:eventId',
        children: [
          { path: '', redirectTo: 'list', pathMatch: 'full' },
          {
            path: 'list',
            loadComponent: () =>
              import('./participant-list/participant-table-tab/participant-table-tab').then(
                (m) => m.ParticipantTableTab,
              ),
            title: pageTitle('Participants'),
          },
          {
            path: 'errors',
            loadComponent: () =>
              import('./participant-list/import-history-tab/import-history-tab').then(
                (m) => m.ImportHistoryTab,
              ),
            title: pageTitle('Import Errors'),
          },
        ],
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./participant-form/participant-form').then((m) => m.ParticipantForm),
        title: pageTitle('New Participant'),
      },
      // Keep edit route last so `:eventId/:bib/edit` cannot greedily match `event/:eventId/...`
      {
        path: ':eventId/:bib/edit',
        loadComponent: () =>
          import('./participant-form/participant-form').then((m) => m.ParticipantForm),
        title: pageTitle('Edit Participant'),
      },
    ],
  },
];
