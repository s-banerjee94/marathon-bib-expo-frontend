import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Feature {
  icon: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-features',
  templateUrl: './features.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Features {
  readonly items: readonly Feature[] = [
    {
      icon: 'box',
      title: 'Bib & goodies distribution',
      body: 'One screen, one scan. Look up by bib, name, phone, or email; tick the kit; move on. Built for queues that don’t slow down.',
    },
    {
      icon: 'upload',
      title: 'CSV import in batches',
      body: 'Drop in a roster of 50,000 participants and the batch job streams updates back. Validation errors are itemized, not silent.',
    },
    {
      icon: 'send',
      title: 'SMS campaigns',
      body: 'Schedule per-race or per-category texts — bib pickup reminders, weather updates, last-call announcements.',
    },
    {
      icon: 'shield',
      title: 'Three roles, scoped access',
      body: 'Admin (you, the organizer) · Employees (your ops team) · Volunteers (race-day distributors). Each role sees only what they need. No accidental data leaks across events.',
    },
    {
      icon: 'chart-bar',
      title: 'Real-time stats',
      body: 'Dashboards refresh as bibs leave the expo. Watch your collection rate hit 95% live, segmented by race and category.',
    },
    {
      icon: 'id-card',
      title: 'Participant lookup',
      body: 'Distributors hit the search box, tap the participant, confirm the kit. Zero training, even for race-day volunteers.',
    },
  ];
}
