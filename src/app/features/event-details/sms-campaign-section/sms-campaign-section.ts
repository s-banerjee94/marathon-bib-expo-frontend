import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { FormsModule } from '@angular/forms';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { SmsCampaign } from '../../../core/models/sms-campaign.model';
import { SmsCampaignService } from '../../../core/services/sms-campaign.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { SmsCampaignForm } from '../sms-campaign-form/sms-campaign-form';
import { SmsCampaignDetail } from '../sms-campaign-detail/sms-campaign-detail';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatDateTimePipe } from '../../../shared/pipes/format-date-time.pipe';
import { SmsTriggerLabelPipe } from '../../../shared/pipes/sms-trigger-label-pipe';
import { SmsTargetLabelPipe } from '../../../shared/pipes/sms-target-label-pipe';
import { TableColumn } from '../../../shared/models/table-config.model';
import {
  SMS_CAMPAIGN_COLUMNS,
  DEFAULT_SMS_CAMPAIGN_COLUMNS,
} from '../../../shared/constants/sms-campaign-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../shared/utils/column.utils';

@Component({
  selector: 'app-sms-campaign-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    MultiSelectModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ConfirmPopupModule,
    DefaultValuePipe,
    FormatDateTimePipe,
    SmsTriggerLabelPipe,
    SmsTargetLabelPipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './sms-campaign-section.html',
  styleUrl: './sms-campaign-section.css',
})
export class SmsCampaignSection implements OnInit {
  eventId = input.required<number>();

  private campaignService = inject(SmsCampaignService);
  private errorHandler = inject(ErrorHandlerService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);

  campaigns = signal<SmsCampaign[]>([]);
  isLoading = signal(true);
  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  actionLoadingId = signal<number | null>(null);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly buttonSize = BUTTON_SIZE;

  private dialogRef: DynamicDialogRef | null = null;

  ngOnInit(): void {
    initializeColumnPreferences(
      SMS_CAMPAIGN_COLUMNS,
      DEFAULT_SMS_CAMPAIGN_COLUMNS,
      STORAGE_KEYS.SMS_CAMPAIGN_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );
    this.loadCampaigns();
  }

  onColumnSelectionChange(): void {
    saveColumnPreferences(this.selectedCols, STORAGE_KEYS.SMS_CAMPAIGN_TABLE_COLUMNS);
  }

  loadCampaigns(): void {
    this.isLoading.set(true);
    this.campaignService.getCampaignsByEvent(this.eventId()).subscribe({
      next: (campaigns) => {
        this.campaigns.set(campaigns);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load SMS campaigns');
        this.isLoading.set(false);
      },
    });
  }

  onCreate(): void {
    this.dialogRef = this.dialogService.open(SmsCampaignForm, {
      header: 'Create SMS Campaign',
      width: '560px',
      data: { campaign: null, eventId: this.eventId() },
    });

    this.dialogRef?.onClose.subscribe((result: SmsCampaign | undefined) => {
      if (result) {
        this.campaigns.update((list) => [result, ...list]);
        this.errorHandler.showSuccess('Campaign created successfully');
      }
    });
  }

  onEdit(campaign: SmsCampaign): void {
    this.dialogRef = this.dialogService.open(SmsCampaignForm, {
      header: 'Edit SMS Campaign',
      width: '560px',
      data: { campaign, eventId: this.eventId() },
    });

    this.dialogRef?.onClose.subscribe((result: SmsCampaign | undefined) => {
      if (result) {
        this.campaigns.update((list) => list.map((c) => (c.id === result.id ? result : c)));
        this.errorHandler.showSuccess('Campaign updated successfully');
      }
    });
  }

  onDelete(campaign: SmsCampaign, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Delete "${campaign.name}"? This cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.campaignService.deleteCampaign(this.eventId(), campaign.id).subscribe({
          next: () => {
            this.campaigns.update((list) => list.filter((c) => c.id !== campaign.id));
            this.errorHandler.showSuccess('Campaign deleted successfully', 'Deleted');
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to delete campaign');
          },
        });
      },
    });
  }

  onDisarm(campaign: SmsCampaign, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Disarm "${campaign.name}"? It will move back to Draft.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Disarm', severity: 'warn' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.actionLoadingId.set(campaign.id);
        this.campaignService.disarmCampaign(this.eventId(), campaign.id).subscribe({
          next: (updated) => {
            this.campaigns.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
            this.actionLoadingId.set(null);
            this.errorHandler.showSuccess('Campaign moved back to Draft', 'Disarmed');
          },
          error: (error: unknown) => {
            this.actionLoadingId.set(null);
            this.errorHandler.showError(error, 'Failed to disarm campaign');
          },
        });
      },
    });
  }

  onView(campaign: SmsCampaign): void {
    this.dialogService.open(SmsCampaignDetail, {
      header: campaign.name,
      width: '560px',
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      data: { campaign },
    });
  }

  statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'SENDING':
        return 'info';
      case 'SENT':
        return 'info';
      case 'FAILED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  canEdit(campaign: SmsCampaign): boolean {
    return campaign.status === 'DRAFT';
  }

  canDisarm(campaign: SmsCampaign): boolean {
    return campaign.status === 'ACTIVE';
  }

  canDelete(campaign: SmsCampaign): boolean {
    return campaign.status === 'DRAFT';
  }

  displayData(): SmsCampaign[] {
    if (this.isLoading()) return Array(3).fill({} as SmsCampaign);
    return this.campaigns();
  }
}
