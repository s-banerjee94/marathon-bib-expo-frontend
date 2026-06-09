import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

const ORGANIZATION_ROLES = [UserRole.ROOT, UserRole.ADMIN];

export const ORGANIZATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./organization-list/organization-list').then((m) => m.OrganizationList),
    canActivate: [roleGuard(ORGANIZATION_ROLES)],
    title: pageTitle('Organizations'),
  },
  {
    // ROOT/ADMIN edit opens the full-page organization account view (not a dialog),
    // where governance fields (tier, billing email, quotas) are also editable.
    path: ':id/edit',
    loadComponent: () =>
      import('../organization-account/organization-account').then((m) => m.OrganizationAccount),
    canActivate: [roleGuard(ORGANIZATION_ROLES)],
    title: pageTitle('Edit Organization'),
    children: [
      { path: '', redirectTo: 'account', pathMatch: 'full' },
      {
        path: 'account',
        loadComponent: () =>
          import('../organization-account/organization-account-details/organization-account-details').then(
            (m) => m.OrganizationAccountDetails,
          ),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('../organization-account/organization-billing-section/organization-billing-section').then(
            (m) => m.OrganizationBillingSection,
          ),
      },
    ],
  },
];
