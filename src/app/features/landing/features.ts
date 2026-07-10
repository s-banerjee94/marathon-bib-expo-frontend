import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardModule } from 'primeng/card';

interface Feature {
  icon: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-features',
  imports: [CardModule],
  templateUrl: './features.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Features {
  readonly items: readonly Feature[] = [
    {
      icon: 'qrcode',
      title: 'Bib & goodies distribution',
      body: 'One screen, one scan. Look up by bib, name, phone, or email; tick the kit; move on. Built for queues that don’t slow down.',
    },
    {
      icon: 'sitemap',
      title: 'Drag-to-map roster import',
      body: 'Connect CSV columns to participant fields visually, for a fresh roster or a batch of walk-ins added at the table. Validation errors stream back itemized, row by row — never a silent failure.',
    },
    {
      icon: 'send',
      title: 'SMS, WhatsApp & email campaigns',
      body: 'Schedule per-race or per-category messages across three channels from one console — pickup reminders, weather updates, last-call announcements.',
    },
    {
      icon: 'comments',
      title: 'AI assistant',
      body: 'Ask it to draft a campaign, look up a participant, or reissue a bib. Every write comes back as a proposed action you approve, edit, or reject first — nothing runs unsupervised.',
    },
    {
      icon: 'verified',
      title: 'Public bib check & expo card',
      body: 'Runners open a short link, no login required, to check their status and download a shareable expo card — the one screen built for the people wearing the bib, not running the table.',
    },
    {
      icon: 'shield',
      title: 'Three roles, scoped access',
      body: 'Organizer Admin, Organizer User, and Distributor inside your organization — each sees only what the job needs. No cross-event or cross-organization leaks.',
    },
  ];
}
