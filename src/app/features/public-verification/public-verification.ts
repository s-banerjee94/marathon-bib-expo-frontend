import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { PublicVerificationService } from '../../core/services/public-verification.service';
import { ParticipantVerificationResponse } from '../../core/models/participant-verification.model';
import { DownloadCardDialog } from './download-card-dialog/download-card-dialog';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { formatGender, getInitials } from './participant-format.util';

// Public, no-auth participant verification page (route /s/:shortCode). Renders
// without the app shell. Shows event + participant + bib/race details and a
// "Download Expo Card" action.
@Component({
  selector: 'app-public-verification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block min-h-screen bg-[radial-gradient(1300px_720px_at_20%_-10%,var(--p-surface-200),var(--p-surface-950))]',
  },
  imports: [ButtonModule, TagModule, SkeletonModule, DownloadCardDialog, DefaultValuePipe],
  templateUrl: './public-verification.html',
})
export class PublicVerification implements OnInit {
  // Bound from the route param via withComponentInputBinding().
  shortCode = input.required<string>();

  private service = inject(PublicVerificationService);

  data = signal<ParticipantVerificationResponse | null>(null);
  isLoading = signal(true);
  notFound = signal(false);
  downloadVisible = signal(false);

  private readonly months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  ngOnInit(): void {
    this.load(this.shortCode());
  }

  private load(code: string): void {
    this.isLoading.set(true);
    this.notFound.set(false);
    this.service.resolveShortUrl(code).subscribe({
      next: (res) => {
        this.data.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.data.set(null);
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  qrSrc = computed<string | null>(() => this.data()?.qrCodeDataUri ?? null);

  initials = computed(() => getInitials(this.data()?.fullName));

  genderLabel = computed(() => formatGender(this.data()?.gender));

  identityLine = computed(() => {
    const d = this.data();
    if (!d) return '';
    return [
      this.genderLabel(),
      d.age ? `Age ${d.age}` : '',
      [d.city, d.country].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join('  ·  ');
  });

  // Event's IANA timezone (e.g. "Asia/Kolkata"); times render in this zone so every
  // viewer sees the venue's wall-clock, not their own local time.
  private eventZone = computed(() => this.data()?.eventTimezone ?? undefined);

  // Event date range in the event's timezone, date only — "8 Nov 2026" for a single
  // day or "8 Nov 2026 - 9 Nov 2026" across days.
  dateRange = computed(() => {
    const d = this.data();
    if (!d) return '';
    const tz = this.eventZone();
    const start = this.fmtDateOnly(d.eventStartDate, tz);
    const end = this.fmtDateOnly(d.eventEndDate, tz);
    if (start && end) {
      return start === end ? start : `${start} - ${end}`;
    }
    return start || end;
  });

  venueLine = computed(() => this.data()?.eventVanue ?? '');

  // Bib collection status drives the header tag.
  bibCollected = computed(() => !!this.data()?.bibCollectedAt);

  collectedAtLabel = computed(() =>
    this.fmtDateOnly(this.data()?.bibCollectedAt, this.eventZone()),
  );

  // Goodies map: { name -> JSON string of { collectedAt, distributedBy } }. Only the
  // names of items that were actually collected (have a collectedAt) are shown.
  goodies = computed<string[]>(() => {
    const raw = this.data()?.goodiesDistribution;
    if (!raw) return [];
    const result: string[] = [];
    for (const [name, json] of Object.entries(raw)) {
      try {
        const parsed = JSON.parse(json) as { collectedAt?: string };
        if (parsed.collectedAt) result.push(name);
      } catch {
        // Skip unparseable / uncollected entries.
      }
    }
    return result;
  });

  openDownload(): void {
    this.downloadVisible.set(true);
  }

  // Calendar date only in the given timezone, e.g. "8 Nov 2026". Date-only strings
  // (no time/zone) render the literal calendar date.
  private fmtDateOnly(value?: string | null, tz?: string): string {
    if (!value) return '';
    if (!value.includes('T')) {
      const [y, m, day] = value.split('-').map(Number);
      if (!y || !m || !day) return value;
      return `${day} ${this.months[m - 1]} ${y}`;
    }
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    const get = this.partsIn(dt, tz, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${get('day')} ${get('month')} ${get('year')}`;
  }

  // Returns a part lookup for an instant in `tz`, falling back to the viewer's local
  // zone if `tz` is invalid/unknown.
  private partsIn(
    dt: Date,
    tz: string | undefined,
    options: Intl.DateTimeFormatOptions,
  ): (type: Intl.DateTimeFormatPartTypes) => string {
    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...options }).formatToParts(dt);
    } catch {
      parts = new Intl.DateTimeFormat('en-US', options).formatToParts(dt);
    }
    return (type) => parts.find((p) => p.type === type)?.value ?? '';
  }
}
