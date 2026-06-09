import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

// Platform-wide billing console — ROOT/ADMIN oversee every organization's bills.
const BILLING_ROLES = [UserRole.ROOT, UserRole.ADMIN];

export const BILLING_ROUTES: Routes = [
  {
    // Tab shell (header + URL-driven tab strip + router-outlet), mirroring the
    // events / participants tabbed-route pattern.
    path: '',
    loadComponent: () =>
      import('./platform-billing/platform-billing').then((m) => m.PlatformBilling),
    canActivate: [roleGuard(BILLING_ROLES)],
    title: pageTitle('Billing'),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./billing-overview/billing-overview').then((m) => m.BillingOverview),
        title: pageTitle('Billing'),
      },
      {
        path: 'all-bills',
        loadComponent: () =>
          import('./billing-all-bills/billing-all-bills').then((m) => m.BillingAllBills),
        title: pageTitle('All Bills'),
      },
    ],
  },
];
