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
        path: 'templates',
        loadComponent: () =>
          import('./event-details/templates-section/templates-section').then(
            (m) => m.TemplatesSection,
          ),
        title: pageTitle('Event Templates'),
        children: [
          { path: '', redirectTo: 'sms', pathMatch: 'full' },
          {
            path: 'sms',
            loadComponent: () =>
              import('./event-details/sms-template-section/sms-template-section').then(
                (m) => m.SmsTemplateSection,
              ),
          },
          {
            path: 'whatsapp',
            loadComponent: () =>
              import('./event-details/whatsapp-template-section/whatsapp-template-section').then(
                (m) => m.WhatsappTemplateSection,
              ),
          },
          {
            path: 'email',
            loadComponent: () =>
              import('./event-details/email-template-section/email-template-section').then(
                (m) => m.EmailTemplateSection,
              ),
          },
        ],
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./event-details/campaigns-section/campaigns-section').then(
            (m) => m.CampaignsSection,
          ),
        title: pageTitle('Event Campaigns'),
        children: [
          { path: '', redirectTo: 'sms', pathMatch: 'full' },
          {
            path: 'sms',
            loadComponent: () =>
              import('./event-details/sms-campaign-section/sms-campaign-section').then(
                (m) => m.SmsCampaignSection,
              ),
          },
          {
            path: 'whatsapp',
            loadComponent: () =>
              import('./event-details/whatsapp-campaign-section/whatsapp-campaign-section').then(
                (m) => m.WhatsappCampaignSection,
              ),
          },
          {
            path: 'email',
            loadComponent: () =>
              import('./event-details/email-campaign-section/email-campaign-section').then(
                (m) => m.EmailCampaignSection,
              ),
          },
        ],
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
      {
        // Limits are visible/editable to ROOT/ADMIN only. The guard 401s organizer roles
        // who deep-link the URL (backend GET/PATCH also 403s them).
        path: 'limits',
        loadComponent: () =>
          import('./event-details/event-limits-section/event-limits-section').then(
            (m) => m.EventLimitsSection,
          ),
        canActivate: [roleGuard([UserRole.ROOT, UserRole.ADMIN])],
        title: pageTitle('Event Limits'),
      },
    ],
  },
];
