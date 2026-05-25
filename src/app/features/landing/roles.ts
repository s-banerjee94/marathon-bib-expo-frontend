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
      tag: 'ADMIN',
      title: 'For the organizer',
      body: 'You own the event end-to-end. Create races, set capacity, run SMS campaigns, audit pickups, manage your team.',
      caps: [
        'Full event CRUD',
        'Roster import + edit',
        'SMS campaign builder',
        'Live analytics dashboard',
      ],
    },
    {
      tag: 'EMPLOYEE',
      title: 'For your team',
      body: 'Your ops people add participants, fix typos, build SMS templates, and run reports day-to-day.',
      caps: ['Manage participants', 'Build SMS templates', 'Run roster imports', 'View live stats'],
    },
    {
      tag: 'VOLUNTEER',
      title: 'For race-day distributors',
      body: 'You’re at the table on race-day morning. One screen, one task: hand bibs to the right people, fast.',
      caps: [
        'Bib / name / phone lookup',
        'Goodies checklist',
        'Offline-friendly UI',
        '18-second average pickup',
      ],
    },
  ];
}
