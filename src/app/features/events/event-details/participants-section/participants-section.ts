import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import { Participant } from '../../../../core/models/participant.model';
import { ParticipantTableTab } from '../../../participants/participant-list/participant-table-tab/participant-table-tab';
import { ParticipantDetails } from '../../../participants/participant-details/participant-details';
import { ParticipantListState } from '../../../participants/participant-list/participant-list-state.service';
import { injectIsMobile } from '../../../../shared/utils/responsive.utils';
import { EventDetailsState } from '../event-details-state.service';

@Component({
  selector: 'app-participants-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participants-section.html',
  imports: [DialogModule, ConfirmDialogModule, ParticipantTableTab, ParticipantDetails],
  providers: [ConfirmationService, ParticipantListState],
})
export class ParticipantsSection {
  private readonly state = inject(EventDetailsState);
  protected readonly isMobile = injectIsMobile();

  protected readonly eventId = computed(() => this.state.event()?.id ?? null);

  // Details dialog (view + per-field inline edit)
  protected readonly showDetailsDialog = signal(false);
  protected readonly detailsBibNumber = signal<string | null>(null);

  // PrimeNG p-dialog style — fullscreen on mobile, modal on desktop
  protected readonly detailsStyle = computed(() =>
    this.isMobile()
      ? { width: '100vw', height: '100vh', maxHeight: '100vh' }
      : { width: '95vw', maxWidth: '1100px', height: '90vh' },
  );

  protected onDetails(participant: Participant): void {
    this.detailsBibNumber.set(participant.bibNumber);
    this.showDetailsDialog.set(true);
  }

  protected closeDetailsDialog(): void {
    this.showDetailsDialog.set(false);
    this.detailsBibNumber.set(null);
  }
}
