import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Role {
  tag: string;
  title: string;
  body: string;
  caps: readonly string[];
}

@Component({
  selector: 'app-roles',
  templateUrl: './roles.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Roles {
  readonly roles: readonly Role[] = [
    {
      tag: 'ORGANIZER ADMIN',
      title: 'For the organizer',
      body: 'You own the event end-to-end. Create races, set limits, run SMS/WhatsApp/email campaigns, review the audit trail, manage your team.',
      caps: [
        'Full event CRUD',
        'Drag-to-map roster import',
        'SMS · WhatsApp · Email campaigns',
        'Live, role-aware dashboard',
      ],
    },
    {
      tag: 'ORGANIZER USER',
      title: 'For your team',
      body: 'Your ops people add participants, fix typos, build message templates, and run reports day-to-day.',
      caps: [
        'Manage participants',
        'Build campaign templates',
        'Run roster imports',
        'View live stats',
      ],
    },
    {
      tag: 'DISTRIBUTOR',
      title: 'For expo-day scanning',
      body: 'You’re at the table on distribution day, bound to one event. One screen, one task: scan or search, hand over the kit, move on.',
      caps: [
        'QR scan or manual lookup',
        'Goodies checklist',
        'Works offline at the table',
        'Bound to a single event',
      ],
    },
  ];
}
