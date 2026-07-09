import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guard';
import { UserRole } from '../../core/models/user.model';
import { pageTitle } from '../../shared/constants/app.constant';

// ROOT-only platform messaging configuration — one tab per channel.
const SYSTEM_MESSAGING_ROLES = [UserRole.ROOT];

export const SYSTEM_MESSAGING_ROUTES: Routes = [
  {
    // Tab shell (SMS | WhatsApp | Email) + router-outlet. Each channel tab renders a
    // console with its provider connection and message templates; a template opens in
    // a full-width editor in the same outlet.
    path: '',
    loadComponent: () =>
      import('./system-messaging/system-messaging').then((m) => m.SystemMessaging),
    canActivate: [roleGuard(SYSTEM_MESSAGING_ROLES)],
    title: pageTitle('System Messaging'),
    children: [
      { path: '', redirectTo: 'SMS', pathMatch: 'full' },
      {
        path: ':channel',
        loadComponent: () =>
          import('./channel-console/channel-console').then((m) => m.ChannelConsole),
      },
      {
        path: ':channel/templates/:purpose',
        loadComponent: () =>
          import('./template-editor/template-editor').then((m) => m.TemplateEditor),
        title: pageTitle('Edit Template'),
      },
    ],
  },
];
