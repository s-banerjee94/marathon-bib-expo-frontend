import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { WhatsAppCampaign } from '../../../../core/models/whatsapp-campaign.model';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EventDetailsState } from '../event-details-state.service';
import { WhatsappCampaignForm } from '../whatsapp-campaign-form/whatsapp-campaign-form';
import { WhatsappCampaignDetail } from '../whatsapp-campaign-detail/whatsapp-campaign-detail';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { FormatEventDateTimePipe } from '../../../../shared/pipes/format-event-date-time-pipe';
import { SmsTriggerLabelPipe } from '../../../../shared/pipes/sms-trigger-label-pipe';
import { SmsTargetLabelPipe } from '../../../../shared/pipes/sms-target-label-pipe';
import { InitialsPipe } from '../../../../shared/pipes/initials-pipe';
import { UserSummaryPipe } from '../../../../shared/pipes/user-summary-pipe';
import { TableColumn } from '../../../../shared/models/table-config.model';
import {
  WHATSAPP_CAMPAIGN_COLUMNS,
  DEFAULT_WHATSAPP_CAMPAIGN_COLUMNS,
} from '../../../../shared/constants/whatsapp-campaign-columns.constant';
import { STORAGE_KEYS } from '../../../../shared/constants/storage-keys.constant';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { LocalStorageService } from '../../../../core/services/local-storage.service';
import {
  enforceRequiredColumns,
  getVisibleCols,
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../../shared/utils/column.utils';
import { injectIsMobile } from '../../../../shared/utils/responsive.utils';
import { getCampaignStatusSeverity } from '../../../../shared/utils/campaign-status.utils';

@Component({
  selector: 'app-whatsapp-campaign-section',
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
    AvatarModule,
    ConfirmPopupModule,
    CardModule,
    RouterLink,
    DefaultValuePipe,
    FormatEventDateTimePipe,
    SmsTriggerLabelPipe,
    SmsTargetLabelPipe,
    InitialsPipe,
    UserSummaryPipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './whatsapp-campaign-section.html',
  styleUrl: './whatsapp-campaign-section.css',
})
export class WhatsappCampaignSection implements OnInit {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private campaignService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private storage = inject(LocalStorageService);
  private state = inject(EventDetailsState);

  protected readonly eventTimezone = computed(() => this.state.event()?.timezone ?? '');

  campaigns = signal<WhatsAppCampaign[]>([]);
  isLoading = signal(true);
  isMobile = injectIsMobile();
  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  visibleCols = computed(() => getVisibleCols(WHATSAPP_CAMPAIGN_COLUMNS, this.selectedCols()));
  displayData = computed(() =>
    this.isLoading() ? (Array(3).fill({}) as WhatsAppCampaign[]) : this.campaigns(),
  );
  actionLoadingId = signal<number | null>(null);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly buttonSize = BUTTON_SIZE;

  ngOnInit(): void {
    initializeColumnPreferences(
      this.storage,
      WHATSAPP_CAMPAIGN_COLUMNS,
      DEFAULT_WHATSAPP_CAMPAIGN_COLUMNS,
      STORAGE_KEYS.WHATSAPP_CAMPAIGN_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );
    this.loadCampaigns();
  }

  onColumnSelectionChange(): void {
    enforceRequiredColumns(this.selectedCols, WHATSAPP_CAMPAIGN_COLUMNS);
    saveColumnPreferences(
      this.storage,
      this.selectedCols,
      STORAGE_KEYS.WHATSAPP_CAMPAIGN_TABLE_COLUMNS,
    );
  }

  loadCampaigns(): void {
    this.isLoading.set(true);
    this.campaignService.getCampaignsByEvent(this.eventId()).subscribe({
      next: (campaigns) => {
        this.campaigns.set(campaigns);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load WhatsApp campaigns');
        this.isLoading.set(false);
      },
    });
  }

  onCreate(): void {
    const ref = this.dialogService.open(WhatsappCampaignForm, {
      header: 'Create WhatsApp Campaign',
      width: '560px',
      data: { campaign: null, eventId: this.eventId(), eventTimezone: this.eventTimezone() },
    });

    ref?.onClose.subscribe((result: WhatsAppCampaign | undefined) => {
      if (result) {
        this.campaigns.update((list) => [result, ...list]);
        this.toast.success('Campaign created successfully');
      }
    });
  }

  onEdit(campaign: WhatsAppCampaign): void {
    const ref = this.dialogService.open(WhatsappCampaignForm, {
      header: 'Edit WhatsApp Campaign',
      width: '560px',
      data: { campaign, eventId: this.eventId(), eventTimezone: this.eventTimezone() },
    });

    ref?.onClose.subscribe((result: WhatsAppCampaign | undefined) => {
      if (result) {
        this.campaigns.update((list) => list.map((c) => (c.id === result.id ? result : c)));
        this.toast.success('Campaign updated successfully');
      }
    });
  }

  onDelete(campaign: WhatsAppCampaign, event: Event): void {
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
            this.toast.success('Campaign deleted successfully', 'Deleted');
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error);
          },
        });
      },
    });
  }

  onDisarm(campaign: WhatsAppCampaign, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Disarm "${campaign.name}"? It will move back to Draft.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Disarm', severity: 'warn' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.actionLoadingId.set(campaign.id);
        this.campaignService
          .disarmCampaign(this.eventId(), campaign.id)
          .pipe(finalize(() => this.actionLoadingId.set(null)))
          .subscribe({
            next: (updated) => {
              this.campaigns.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
              this.toast.success('Campaign moved back to Draft', 'Disarmed');
            },
            error: (error: unknown) => {
              this.errorHandler.showError(error, 'Failed to disarm campaign');
            },
          });
      },
    });
  }

  onView(campaign: WhatsAppCampaign): void {
    this.dialogService.open(WhatsappCampaignDetail, {
      header: campaign.name,
      width: '560px',
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      data: { campaign, eventTimezone: this.eventTimezone() },
    });
  }

  readonly statusSeverity = getCampaignStatusSeverity;

  canEdit(campaign: WhatsAppCampaign): boolean {
    return campaign.status === 'DRAFT';
  }

  canDisarm(campaign: WhatsAppCampaign): boolean {
    return campaign.status === 'ACTIVE';
  }

  canDelete(campaign: WhatsAppCampaign): boolean {
    return campaign.status === 'DRAFT';
  }
}
