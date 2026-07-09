import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ParticipantDetails } from './participant-details';

/**
 * Standalone, shareable page for a single participant
 * (`/participants/:eventId/:bibNumber/details`). Reached by the dialog's "share"
 * link and "open in new tab" action, and by direct / bookmarked URLs. Renders
 * <app-participant-details> in editable mode with a link back to the list.
 *
 * The in-app dialog (in ParticipantList) is signal-driven for speed; this route
 * exists purely so the same view+edit is addressable by URL — opening it never
 * unmounts the list because it is only ever navigated to in a *new* tab.
 */
@Component({
  selector: 'app-participant-details-route',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ParticipantDetails],
  template: `
    <div class="p-2 sm:p-3 md:p-4">
      <div class="mb-3">
        <p-button
          (onClick)="backToList()"
          [text]="true"
          icon="pi pi-arrow-left"
          label="Back to Participants"
          severity="secondary"
          size="small"
        />
      </div>
      <app-participant-details [eventId]="eventId()" [bibNumber]="bibNumber()" [editable]="true" />
    </div>
  `,
})
export class ParticipantDetailsRoute {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  eventId = input.required<number, number | string>({ transform: (v) => Number(v) });
  bibNumber = input.required<string>();

  protected backToList(): void {
    const organizationId = this.route.snapshot.queryParamMap.get('organizationId');
    this.router.navigate(['/participants/event', this.eventId(), 'list'], {
      queryParams: {
        organizationId: organizationId || null,
        eventId: this.eventId(),
      },
    });
  }
}
