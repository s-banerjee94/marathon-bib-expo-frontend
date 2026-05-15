import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import {
  SmsCampaign,
  SmsCampaignTargetFilter,
  SmsCampaignTriggerType,
  CreateSmsCampaignRequest,
  UpdateSmsCampaignRequest,
} from '../../../core/models/sms-campaign.model';
import { SmsTemplate } from '../../../core/models/sms-template.model';
import { SmsCampaignService } from '../../../core/services/sms-campaign.service';
import { SmsTemplateService } from '../../../core/services/sms-template.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  SMS_CAMPAIGN_TRIGGER_OPTIONS,
  SMS_CAMPAIGN_TARGET_OPTIONS,
} from '../../../shared/constants/sms-campaign-columns.constant';

@Component({
  selector: 'app-sms-campaign-form',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
    DatePickerModule,
  ],
  templateUrl: './sms-campaign-form.html',
  styleUrl: './sms-campaign-form.css',
})
export class SmsCampaignForm implements OnInit {
  readonly shouldShowError = shouldShowError;

  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private campaignService = inject(SmsCampaignService);
  private smsTemplateService = inject(SmsTemplateService);
  private errorHandler = inject(ErrorHandlerService);

  isEditMode = signal(false);
  isSubmitting = signal(false);
  templates = signal<SmsTemplate[]>([]);
  loadingTemplates = signal(true);

  triggerTypeValue = signal<SmsCampaignTriggerType | null>(null);
  isScheduled = computed(() => this.triggerTypeValue() === 'SCHEDULED');
  hasTrigger = computed(() => !!this.triggerTypeValue());

  readonly minScheduledDate = new Date();
  readonly inputSize = FORM_INPUT_SIZE;
  readonly triggerOptions = SMS_CAMPAIGN_TRIGGER_OPTIONS;
  readonly targetOptions = SMS_CAMPAIGN_TARGET_OPTIONS;

  private eventId!: number;
  private campaignId: number | null = null;

  formData: {
    name: string;
    smsTemplateId: number | null;
    triggerType: SmsCampaignTriggerType | null;
    targetFilter: SmsCampaignTargetFilter | null;
    scheduledAt: Date | null;
  } = {
    name: '',
    smsTemplateId: null,
    triggerType: null,
    targetFilter: null,
    scheduledAt: null,
  };

  ngOnInit(): void {
    const data = this.config.data as { campaign?: SmsCampaign; eventId: number };
    const c = data?.campaign ?? null;
    this.eventId = data.eventId;
    this.campaignId = c?.id ?? null;
    this.isEditMode.set(!!c);

    this.formData = {
      name: c?.name ?? '',
      smsTemplateId: c?.smsTemplateId ?? null,
      triggerType: c?.triggerType ?? null,
      targetFilter: c?.targetFilter ?? null,
      scheduledAt: c?.scheduledAt ? new Date(c.scheduledAt) : null,
    };

    this.triggerTypeValue.set(c?.triggerType ?? null);
    this.loadTemplates(data.eventId);
  }

  onTriggerTypeChange(type: SmsCampaignTriggerType | null): void {
    this.triggerTypeValue.set(type);
    if (!type) {
      this.formData.targetFilter = null;
      this.formData.scheduledAt = null;
    } else if (type !== 'SCHEDULED') {
      this.formData.scheduledAt = null;
    }
  }

  onScheduledAtSelect(value: Date): void {
    this.formData.scheduledAt = value;
  }

  private loadTemplates(eventId: number): void {
    this.smsTemplateService.getSmsTemplatesByEvent(eventId).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loadingTemplates.set(false);
      },
      error: () => this.loadingTemplates.set(false),
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    const payload: Record<string, unknown> = {
      name: this.formData.name,
      smsTemplateId: this.formData.smsTemplateId,
    };

    if (this.formData.triggerType) {
      payload['triggerType'] = this.formData.triggerType;
      payload['targetFilter'] = this.formData.targetFilter;
      if (this.formData.triggerType === 'SCHEDULED') {
        if (!this.formData.scheduledAt) return;
        payload['scheduledAt'] = new Date(this.formData.scheduledAt).toISOString();
      }
    }

    this.isSubmitting.set(true);

    const request$ = this.isEditMode()
      ? this.campaignService.updateCampaign(
          this.eventId,
          this.campaignId!,
          payload as unknown as UpdateSmsCampaignRequest,
        )
      : this.campaignService.createCampaign(
          this.eventId,
          payload as unknown as CreateSmsCampaignRequest,
        );

    request$.subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        this.ref.close(result);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(
          error,
          this.isEditMode() ? 'Failed to update campaign' : 'Failed to create campaign',
        );
      },
    });
  }

  onCancel(): void {
    this.ref.close();
  }
}
