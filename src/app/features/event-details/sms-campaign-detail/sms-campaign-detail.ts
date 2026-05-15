import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SmsCampaign } from '../../../core/models/sms-campaign.model';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatDateTimePipe } from '../../../shared/pipes/format-date-time.pipe';

@Component({
  selector: 'app-sms-campaign-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DividerModule,
    TagModule,
    ButtonModule,
    DefaultValuePipe,
    FormatDateTimePipe,
  ],
  templateUrl: './sms-campaign-detail.html',
})
export class SmsCampaignDetail {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  campaign = signal<SmsCampaign | null>(this.config.data?.campaign ?? null);

  statusSeverity(status: string): 'success' | 'info' | 'secondary' {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'SENT':
        return 'info';
      default:
        return 'secondary';
    }
  }

  triggerLabel(type: string): string {
    switch (type) {
      case 'AUTO_BIB_COLLECTED':
        return 'Auto (Bib Collected)';
      case 'SCHEDULED':
        return 'Scheduled';
      case 'MANUAL':
        return 'Manual';
      default:
        return type;
    }
  }

  targetLabel(filter: string): string {
    return filter === 'ALL' ? 'All Participants' : 'Not Yet Collected';
  }

  onClose(): void {
    this.ref.close();
  }
}
