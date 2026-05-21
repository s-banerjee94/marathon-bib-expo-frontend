import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';

const ORGANIZATION_ROLES = [UserRole.ROOT, UserRole.ADMIN];

export const ORGANIZATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../organization-list/organization-list').then((m) => m.OrganizationList),
    canActivate: [roleGuard(ORGANIZATION_ROLES)],
    children: [
      {
        path: 'new',
        loadComponent: () =>
          import('../organization-form/organization-form').then((m) => m.OrganizationForm),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('../organization-form/organization-form').then((m) => m.OrganizationForm),
      },
    ],
  },
];
