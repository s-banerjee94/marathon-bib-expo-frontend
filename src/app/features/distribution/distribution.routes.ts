import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { pageTitle } from '../../shared/constants/app.constant';

export const DISTRIBUTION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./manage-distribution/manage-distribution').then((m) => m.ManageDistribution),
    canActivate: [authGuard],
    title: pageTitle('Distribution'),
    children: [
      {
        path: 'event/:eventId',
        children: [
          { path: '', redirectTo: 'lookup', pathMatch: 'full' },
          {
            path: 'lookup',
            loadComponent: () =>
              import('./manage-distribution/bib-lookup-tab/bib-lookup-tab').then(
                (m) => m.BibLookupTab,
              ),
            title: pageTitle('BIB Lookup'),
          },
          {
            path: 'pending-bibs',
            loadComponent: () =>
              import('./manage-distribution/pending-bibs-tab/pending-bibs-tab').then(
                (m) => m.PendingBibsTab,
              ),
            title: pageTitle('Pending BIBs'),
          },
          {
            path: 'pending-goodies',
            loadComponent: () =>
              import('./manage-distribution/pending-goodies-tab/pending-goodies-tab').then(
                (m) => m.PendingGoodiesTab,
              ),
            title: pageTitle('Pending Goodies'),
          },
          {
            path: 'logs',
            loadComponent: () =>
              import('./manage-distribution/activity-logs-tab/activity-logs-tab').then(
                (m) => m.ActivityLogsTab,
              ),
            title: pageTitle('Activity Logs'),
          },
        ],
      },
    ],
  },
];
