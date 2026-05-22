import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const DISTRIBUTION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../manage-distribution/manage-distribution').then((m) => m.ManageDistribution),
    canActivate: [authGuard],
  },
];
