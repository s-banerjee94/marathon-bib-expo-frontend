import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LetterPop } from './letter-pop';
import { ScrollReveal } from './scroll-reveal';
import { TiltCard } from './tilt-card';

interface Role {
  tag: string;
  /** Tint classes for the tag chip — each role gets its own hue. */
  tagClass: string;
  title: string;
  body: string;
  caps: readonly string[];
}

@Component({
  selector: 'app-roles',
  imports: [ScrollReveal, TiltCard, LetterPop],
  templateUrl: './roles.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Roles {
  readonly roles: readonly Role[] = [
    {
      tag: 'ORGANIZER ADMIN',
      tagClass:
        'bg-[color-mix(in_srgb,#16a34a,transparent_88%)] text-[#15803d] dark:text-[#4ade80]',
      title: 'For the organizer',
      body: 'The owner seat. Everything in your organization answers to this role — events, races, campaigns, the audit trail, and who on your team does what.',
      caps: [
        'Full control of the organization',
        'Create & run events end-to-end',
        'SMS · WhatsApp · Email campaigns',
        'Manage the team & audit trail',
      ],
    },
    {
      tag: 'ORGANIZER USER',
      tagClass:
        'bg-[color-mix(in_srgb,#2563eb,transparent_88%)] text-[#1d4ed8] dark:text-[#93c5fd]',
      title: 'For your team',
      body: 'The day-to-day operators. They keep events moving and distributors organized — import rosters, fix participant details, build message templates.',
      caps: [
        'Manage events & distributors',
        'Import & maintain the roster',
        'Build campaign templates',
        'View live stats',
      ],
    },
    {
      tag: 'DISTRIBUTOR',
      tagClass:
        'bg-[color-mix(in_srgb,#f59e0b,transparent_85%)] text-[#92400e] dark:text-[#fbbf24]',
      title: 'For expo-day scanning',
      body: 'At the table on distribution day, bound to one event. They see the distribution screen and nothing else: scan or search, hand over the kit, move on.',
      caps: [
        'QR scan or manual lookup',
        'Goodies checklist',
        'Works offline at the table',
        'Distribution only — nothing else',
      ],
    },
  ];
}
