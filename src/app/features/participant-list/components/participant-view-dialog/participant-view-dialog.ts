import { Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { Participant } from '../../../../core/models/participant.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import {
  getGenderDisplay,
  getGenderSeverity,
  getGoodiesKeys,
} from '../../../../shared/utils/participant.utils';

@Component({
  selector: 'app-participant-view-dialog',
  standalone: true,
  templateUrl: './participant-view-dialog.html',
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, DefaultValuePipe],
})
export class ParticipantViewDialog {
  visible = model<boolean>(false);
  participant = input<Participant | null>(null);

  closed = output<void>();

  getGenderDisplay = getGenderDisplay;
  getGenderSeverity = getGenderSeverity;
  getGoodiesKeys = getGoodiesKeys;

  close(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
