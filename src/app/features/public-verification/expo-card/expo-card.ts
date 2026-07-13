import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatGender, getInitials } from '../participant-format.util';

// Presentational, fixed-size (ISO ID-1, 540x340) bib card — the on-screen preview.
// The downloaded PNG is drawn separately in expo-card-canvas.util.ts; keep the two
// in visual sync (fixed colours, same layout) if the design changes.
@Component({
  selector: 'app-expo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block' },
  templateUrl: './expo-card.html',
})
export class ExpoCard {
  eventName = input.required<string>();
  dateLine = input<string>(''); // pre-formatted event date range (date only)
  bibNumber = input.required<string>();
  fullName = input.required<string>();
  chipNumber = input<string | undefined>(undefined);
  gender = input<string | undefined>(undefined);
  raceName = input<string | undefined>(undefined);
  categoryName = input<string | undefined>(undefined);
  qrSrc = input<string | null>(null);
  photoSrc = input<string | null>(null);

  initials = computed(() => getInitials(this.fullName()));

  genderLabel = computed(() => formatGender(this.gender()));
}
