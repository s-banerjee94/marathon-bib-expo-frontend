import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { UserRole } from './core/models/user.model';
import { pageTitle } from './shared/constants/app.constant';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: pageTitle('Login'),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: pageTitle('Dashboard'),
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
    title: pageTitle('My Profile'),
  },
  {
    path: 'organization',
    loadComponent: () =>
      import('./features/organization-account/organization-account').then(
        (m) => m.OrganizationAccount,
      ),
    canActivate: [roleGuard([UserRole.ORGANIZER_ADMIN])],
    title: pageTitle('Organization'),
    children: [
      { path: '', redirectTo: 'account', pathMatch: 'full' },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/organization-account/organization-account-details/organization-account-details').then(
            (m) => m.OrganizationAccountDetails,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/organization-account/organization-settings-section/organization-settings-section').then(
            (m) => m.OrganizationSettingsSection,
          ),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./features/organization-account/organization-billing-section/organization-billing-section').then(
            (m) => m.OrganizationBillingSection,
          ),
      },
    ],
  },
  {
    path: 'organizations',
    loadChildren: () =>
      import('./features/organizations/organizations.routes').then((m) => m.ORGANIZATIONS_ROUTES),
  },
  {
    // Platform-wide billing console — ROOT/ADMIN oversee every organization's bills.
    path: 'billing',
    loadChildren: () => import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
  },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'events',
    loadChildren: () => import('./features/events/events.routes').then((m) => m.EVENTS_ROUTES),
  },
  {
    path: 'participants',
    loadChildren: () =>
      import('./features/participants/participants.routes').then((m) => m.PARTICIPANTS_ROUTES),
  },
  {
    path: 'distribution',
    loadChildren: () =>
      import('./features/distribution/distribution.routes').then((m) => m.DISTRIBUTION_ROUTES),
  },
  {
    path: 'audit-logs',
    loadChildren: () =>
      import('./features/audit-logs/audit-logs.routes').then((m) => m.AUDIT_LOGS_ROUTES),
  },
  {
    // ROOT-only platform messaging config — provider connections + system templates.
    path: 'system-messaging',
    loadChildren: () =>
      import('./features/system-messaging/system-messaging.routes').then(
        (m) => m.SYSTEM_MESSAGING_ROUTES,
      ),
  },
  {
    // Public participant verification short link (no auth, no app shell).
    path: 's/:shortCode',
    loadComponent: () =>
      import('./features/public-verification/public-verification').then(
        (m) => m.PublicVerification,
      ),
    title: pageTitle('Verify Registration'),
  },
  {
    // Public invite-acceptance page (no auth, no app shell). Reached via the
    // /accept-invite?token=… link the backend bakes into issued invites.
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/accept-invitation/accept-invitation').then((m) => m.AcceptInvitation),
    title: pageTitle('Accept Invite'),
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/errors/unauthorized/unauthorized').then((m) => m.Unauthorized),
    title: pageTitle('Unauthorized'),
  },
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found/not-found').then((m) => m.NotFound),
    title: pageTitle('Not Found'),
  },
];
