import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

const EVENT_ROLES = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

export const EVENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./event-list/event-list').then((m) => m.EventList),
    canActivate: [roleGuard(EVENT_ROLES)],
    title: pageTitle('Events'),
    children: [
      {
        path: 'new',
        loadComponent: () => import('./event-form/event-form').then((m) => m.EventForm),
        title: pageTitle('New Event'),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./event-form/event-form').then((m) => m.EventForm),
        title: pageTitle('Edit Event'),
      },
    ],
  },
  {
    path: ':eventId',
    loadComponent: () =>
      import('./event-details/event-details/event-details').then((m) => m.EventDetails),
    canActivate: [roleGuard(EVENT_ROLES)],
    title: pageTitle('Event Details'),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./event-details/event-dashboard-section/event-dashboard-section').then(
            (m) => m.EventDashboardSection,
          ),
        title: pageTitle('Event Dashboard'),
      },
      {
        path: 'participants',
        loadComponent: () =>
          import('./event-details/participants-section/participants-section').then(
            (m) => m.ParticipantsSection,
          ),
        title: pageTitle('Event Participants'),
      },
      {
        path: 'goodies',
        loadComponent: () =>
          import('./event-details/goodies-section/goodies-section').then((m) => m.GoodiesSection),
        title: pageTitle('Event Goodies'),
      },
      {
        path: 'races',
        loadComponent: () =>
          import('./event-details/race-section/race-section').then((m) => m.RaceSection),
        title: pageTitle('Event Races'),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./event-details/category-section/category-section').then(
            (m) => m.CategorySection,
          ),
        title: pageTitle('Event Categories'),
      },
      {
        path: 'sms-templates',
        loadComponent: () =>
          import('./event-details/sms-template-section/sms-template-section').then(
            (m) => m.SmsTemplateSection,
          ),
        title: pageTitle('Event SMS Templates'),
      },
      {
        path: 'sms-campaigns',
        loadComponent: () =>
          import('./event-details/sms-campaign-section/sms-campaign-section').then(
            (m) => m.SmsCampaignSection,
          ),
        title: pageTitle('Event SMS Campaigns'),
      },
      {
        // Bills are visible to ROOT/ADMIN/ORGANIZER_ADMIN only — not ORGANIZER_USER.
        // The guard 401s ORGANIZER_USER who deep-links the URL (backend GET also 403s them).
        path: 'billing',
        loadComponent: () =>
          import('./event-details/event-billing-section/event-billing-section').then(
            (m) => m.EventBillingSection,
          ),
        canActivate: [roleGuard([UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN])],
        title: pageTitle('Event Billing'),
      },
    ],
  },
];
