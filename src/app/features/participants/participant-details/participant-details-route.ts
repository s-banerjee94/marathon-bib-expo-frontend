import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ParticipantDetails } from './participant-details';

/**
 * Thin route wrapper that mounts <app-participant-details> in editable mode for
 * the standalone /participants/:eventId/:bibNumber/details URL. Used on mobile
 * (full-page) and as a deep-link fallback on desktop. Desktop hosts that open
 * the details dialog inline render <app-participant-details> directly.
 */
@Component({
  selector: 'app-participant-details-route',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParticipantDetails],
  template: `
    <div class="p-2 sm:p-3 md:p-4">
      <app-participant-details [eventId]="eventId()" [bibNumber]="bibNumber()" [editable]="true" />
    </div>
  `,
})
export class ParticipantDetailsRoute {
  eventId = input.required<number, number | string>({ transform: (v) => Number(v) });
  bibNumber = input.required<string>();
}
