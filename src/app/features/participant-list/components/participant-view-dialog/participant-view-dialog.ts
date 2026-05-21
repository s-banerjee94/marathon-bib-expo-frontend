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

  // Parse backend DOB string (dd-MM-yyyy or ISO yyyy-MM-dd) into a Date so Angular's date pipe can format it.
  parseDob(value: string | undefined): Date | null {
    if (!value) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(value);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return null;
  }

  close(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
