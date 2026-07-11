import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';
import { unsavedMappingGuard } from '../import-mapper/unsaved-mapping.guard';

const PARTICIPANT_ROLES = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

export const PARTICIPANTS_ROUTES: Routes = [
  {
    // Temporary CSV → participant column-mapping route (produces the mapping JSON contract).
    // Standalone full page — kept as a sibling so it does not render inside the list shell.
    path: 'import-map',
    loadComponent: () => import('../import-mapper/import-mapper').then((m) => m.ImportMapper),
    canActivate: [roleGuard(PARTICIPANT_ROLES)],
    canDeactivate: [unsavedMappingGuard],
    title: pageTitle('Import Mapper'),
  },
  {
    // Shareable, standalone participant view+edit page. Sibling of the list shell
    // (not a child) so a shared/opened link loads just this participant — the list
    // dialog stays signal-driven and is only ever navigated here in a new tab.
    // Listed before '' so its literal `details` 3rd segment matches first.
    path: ':eventId/:bibNumber/details',
    loadComponent: () =>
      import('./participant-details/participant-details-route').then(
        (m) => m.ParticipantDetailsRoute,
      ),
    canActivate: [roleGuard(PARTICIPANT_ROLES)],
    title: pageTitle('Participant Details'),
  },
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
      // The create form and participant details are signal-driven dialogs in
      // ParticipantList (not routes), so opening/closing one never unmounts the
      // table behind it — closing is instant, with no re-render or refetch.
    ],
  },
];
