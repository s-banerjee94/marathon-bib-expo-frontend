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
            // withComponentInputBinding sets any input without a matching route value
            // to undefined, overriding its default — so we MUST pass every flag the
            // table-tab needs. Import/Export/Add live in the page shell (toolbar off),
            // and the selection column stays on so bulk delete works here too.
            data: { showActionToolbar: false, showSelectionColumn: true },
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
      // Details (view + per-field inline edit). Replaces the legacy `:eventId/:bib/edit` form route.
      // Keep last so `:eventId/:bibNumber/details` cannot greedily match `event/:eventId/...`.
      {
        path: ':eventId/:bibNumber/details',
        loadComponent: () =>
          import('./participant-details/participant-details-route').then(
            (m) => m.ParticipantDetailsRoute,
          ),
        title: pageTitle('Participant Details'),
      },
    ],
  },
];
