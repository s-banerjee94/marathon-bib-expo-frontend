import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SmsCampaign } from '../../../../core/models/sms-campaign.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { FormatEventDateTimePipe } from '../../../../shared/pipes/format-event-date-time-pipe';
import { SmsTriggerLabelPipe } from '../../../../shared/pipes/sms-trigger-label-pipe';
import { SmsTargetLabelPipe } from '../../../../shared/pipes/sms-target-label-pipe';
import { getCampaignStatusSeverity } from '../../../../shared/utils/campaign-status.utils';

@Component({
  selector: 'app-sms-campaign-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DividerModule,
    TagModule,
    ButtonModule,
    DefaultValuePipe,
    FormatEventDateTimePipe,
    SmsTriggerLabelPipe,
    SmsTargetLabelPipe,
  ],
  templateUrl: './sms-campaign-detail.html',
})
export class SmsCampaignDetail {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  campaign = signal<SmsCampaign | null>(this.config.data?.campaign ?? null);
  eventTimezone = signal<string>(this.config.data?.eventTimezone ?? '');

  readonly statusSeverity = getCampaignStatusSeverity;

  onClose(): void {
    this.ref.close();
  }
}
