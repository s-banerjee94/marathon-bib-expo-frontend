import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Qa {
  q: string;
  a: string;
}

@Component({
  selector: 'app-faq',
  templateUrl: './faq.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Faq {
  readonly qa: readonly Qa[] = [
    {
      q: 'Do we need to install anything for race day?',
      a: 'No. Distributors open the web app on any laptop or tablet, sign in with their assigned credentials, and they’re ready. The lookup UI is touch-friendly and works on cellular if your expo venue has weak wifi.',
    },
    {
      q: 'Can we import bibs and chip numbers separately?',
      a: 'Yes. Bib numbers and chip numbers are separate columns in the CSV import. You can also update them post-import via the participant edit dialog.',
    },
    {
      q: 'What happens if a participant loses their bib?',
      a: 'A distributor can reissue a new bib number against the same participant record; the audit log keeps the original entry plus the swap.',
    },
    {
      q: 'How do roles map to my organization?',
      a: 'You (the race organizer) sign up as the Admin and own everything in your account. You invite Employees — ops team members who help manage participants and events. On race day, you create Volunteer accounts for distributors at the expo — they only see the bib-pickup screen. Three roles, scoped permissions, no overlap.',
    },
    {
      q: 'Do you integrate with timing systems?',
      a: 'Marathon Bib Expo handles the bib distribution side. Export your roster as CSV in the format your timing vendor expects — the chip-to-participant mapping is ready to plug into any major timing platform.',
    },
    {
      q: 'Does it work on mobile and tablets?',
      a: 'Yes — the entire platform runs in the browser and adapts to any device. Admins manage events from their desktop, employees can edit participants from a tablet at the office, and volunteers run the bib-pickup screen from a phone or tablet at the expo table. No app to install.',
    },
  ];
}
