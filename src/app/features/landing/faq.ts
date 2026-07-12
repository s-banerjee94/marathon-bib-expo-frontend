import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FaqReveal } from './faq-reveal';
import { LetterPop } from './letter-pop';
import { ScrollReveal } from './scroll-reveal';

interface Qa {
  q: string;
  a: string;
}

@Component({
  selector: 'app-faq',
  imports: [ScrollReveal, LetterPop, FaqReveal],
  templateUrl: './faq.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Faq {
  readonly qa: readonly Qa[] = [
    {
      q: 'Do runners register for the race through Marathon Bib Expo?',
      a: 'No. Registration happens on your own platform — sometimes more than one. Once it closes, you bring the results in: import the full roster as a CSV, or add and edit participants one at a time. Marathon Bib Expo starts where registration ends and runs through hand-off at the expo.',
    },
    {
      q: 'Do we need to install anything for the expo?',
      a: "No. Distributors open the web app on any laptop, tablet, or phone, sign in with their assigned credentials, and they’re ready. It can also be installed as an app for a home-screen icon, but that's optional — and the interface keeps working if the venue wifi drops.",
    },
    {
      q: 'Can we import bibs and chip numbers separately?',
      a: 'Yes. The drag-to-map import wizard connects bib number, chip number, size, and goodies to their own CSV columns. You can also update them post-import via the participant edit dialog.',
    },
    {
      q: 'What happens if a participant loses their bib?',
      a: 'A distributor can reissue a new bib number against the same participant record; the audit log keeps the original entry plus the swap.',
    },
    {
      q: 'How do roles map to my organization?',
      a: "Your organization gets an Organizer Admin account — that's the owner, with full event and team control. You invite Organizer Users to help manage participants and events day-to-day. At the expo, you create Distributor accounts bound to a single event — they only see the scan and lookup screen. Three roles, scoped permissions, no overlap.",
    },
    {
      q: 'Do you integrate with timing systems?',
      a: 'Marathon Bib Expo handles the bib distribution side. Export your roster as CSV in the format your timing vendor expects — the chip-to-participant mapping is ready to plug into any major timing platform.',
    },
    {
      q: 'Does it work on mobile and tablets?',
      a: 'Yes — the entire platform runs in the browser and adapts to any device. Organizer Admins manage events from their desktop, Organizer Users can edit participants from a tablet at the office, and Distributors run the scan screen from a phone or tablet at the expo table. No app to install.',
    },
    {
      q: 'How do we get started?',
      a: "There's no self-serve signup — we set up your organization and first Organizer Admin login for you. Book a demo and we'll walk through creating your first event live on the call.",
    },
    {
      q: 'What does the AI assistant actually do?',
      a: "It's a chat panel scoped to your account — ask it to look up a participant, draft a campaign, or check event stats. Anything that would change data comes back as a proposed action you approve, edit, or reject first. It never writes anything on its own.",
    },
  ];
}
