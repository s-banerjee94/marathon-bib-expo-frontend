import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { buildDirtyPatch, shouldShowError } from '../../../../shared/utils/form.utils';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import {
  WhatsAppCampaign,
  WhatsAppCampaignTargetFilter,
  WhatsAppCampaignTriggerType,
  CreateWhatsAppCampaignRequest,
  UpdateWhatsAppCampaignRequest,
} from '../../../../core/models/whatsapp-campaign.model';
import { WhatsAppTemplate } from '../../../../core/models/whatsapp-template.model';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import {
  SMS_CAMPAIGN_TRIGGER_OPTIONS,
  SMS_CAMPAIGN_TARGET_OPTIONS,
} from '../../../../shared/constants/sms-campaign-columns.constant';
import {
  computeMinScheduledDate,
  parseScheduledDateTime,
  toScheduledDate,
  toScheduledTime,
} from '../../../../shared/utils/campaign-schedule.utils';

@Component({
  selector: 'app-whatsapp-campaign-form',
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
  templateUrl: './whatsapp-campaign-form.html',
  styleUrl: './whatsapp-campaign-form.css',
})
export class WhatsappCampaignForm implements OnInit {
  readonly shouldShowError = shouldShowError;

  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private whatsAppService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);

  isEditMode = signal(false);
  isSubmitting = signal(false);
  templates = signal<WhatsAppTemplate[]>([]);
  loadingTemplates = signal(true);
  eventTimezone = signal<string>('');
  minScheduledDate = signal<Date>(new Date());

  triggerTypeValue = signal<WhatsAppCampaignTriggerType | null>(null);
  isScheduled = computed(() => this.triggerTypeValue() === 'SCHEDULED');
  hasTrigger = computed(() => !!this.triggerTypeValue());

  readonly inputSize = FORM_INPUT_SIZE;
  readonly triggerOptions = SMS_CAMPAIGN_TRIGGER_OPTIONS;
  readonly targetOptions = SMS_CAMPAIGN_TARGET_OPTIONS;

  private eventId!: number;
  private campaignId: number | null = null;

  formData: {
    name: string;
    whatsAppTemplateId: number | null;
    triggerType: WhatsAppCampaignTriggerType | null;
    targetFilter: WhatsAppCampaignTargetFilter | null;
    scheduledAt: Date | null;
  } = {
    name: '',
    whatsAppTemplateId: null,
    triggerType: null,
    targetFilter: null,
    scheduledAt: null,
  };

  ngOnInit(): void {
    const data = this.config.data as {
      campaign?: WhatsAppCampaign;
      eventId: number;
      eventTimezone?: string;
    };
    const c = data?.campaign ?? null;
    this.eventId = data.eventId;
    this.campaignId = c?.id ?? null;
    this.isEditMode.set(!!c);

    const tz = data.eventTimezone ?? '';
    this.eventTimezone.set(tz);
    this.minScheduledDate.set(computeMinScheduledDate(tz));

    const scheduledAt = parseScheduledDateTime(c?.scheduledDate, c?.scheduledTime);

    this.formData = {
      name: c?.name ?? '',
      whatsAppTemplateId: c?.whatsAppTemplateId ?? null,
      triggerType: c?.triggerType ?? null,
      targetFilter: c?.targetFilter ?? null,
      scheduledAt,
    };

    this.triggerTypeValue.set(c?.triggerType ?? null);
    this.loadTemplates(data.eventId);
  }

  onTriggerTypeChange(type: WhatsAppCampaignTriggerType | null): void {
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
    this.whatsAppService.getTemplatesByEvent(eventId).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loadingTemplates.set(false);
      },
      error: () => this.loadingTemplates.set(false),
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    const payload = this.isEditMode() ? this.buildPatch(form) : this.buildPayload();

    if (this.isEditMode() && !Object.keys(payload).length) {
      this.ref.close();
      return;
    }

    this.isSubmitting.set(true);

    const request$ = this.isEditMode()
      ? this.whatsAppService.updateCampaign(
          this.eventId,
          this.campaignId!,
          payload as UpdateWhatsAppCampaignRequest,
        )
      : this.whatsAppService.createCampaign(this.eventId, payload as CreateWhatsAppCampaignRequest);

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

  private buildPayload(): CreateWhatsAppCampaignRequest {
    const payload: CreateWhatsAppCampaignRequest = {
      name: this.formData.name,
      whatsAppTemplateId: this.formData.whatsAppTemplateId!,
    };

    if (this.formData.triggerType) {
      payload.triggerType = this.formData.triggerType;
      payload.targetFilter = this.formData.targetFilter ?? undefined;
      if (this.formData.triggerType === 'SCHEDULED' && this.formData.scheduledAt) {
        payload.scheduledDate = toScheduledDate(this.formData.scheduledAt);
        payload.scheduledTime = toScheduledTime(this.formData.scheduledAt);
      }
    }

    return payload;
  }

  private buildPatch(form: NgForm): UpdateWhatsAppCampaignRequest {
    const patch = buildDirtyPatch<UpdateWhatsAppCampaignRequest>(
      form,
      this.formData,
      new Set(['scheduledAt']),
    );

    if (form.controls['scheduledAt']?.dirty && this.formData.scheduledAt) {
      patch.scheduledDate = toScheduledDate(this.formData.scheduledAt);
      patch.scheduledTime = toScheduledTime(this.formData.scheduledAt);
    }

    return patch;
  }

  onCancel(): void {
    this.ref.close();
  }
}
