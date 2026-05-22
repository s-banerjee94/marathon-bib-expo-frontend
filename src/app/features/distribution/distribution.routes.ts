import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { pageTitle } from '../../shared/constants/app.constant';

export const DISTRIBUTION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../manage-distribution/manage-distribution').then((m) => m.ManageDistribution),
    canActivate: [authGuard],
    title: pageTitle('Distribution'),
  },
];
