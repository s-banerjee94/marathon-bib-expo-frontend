import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { Popover } from 'primeng/popover';
import {
  SmsTemplate,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../../../../core/models/sms-template.model';
import { SmsTemplateService } from '../../../../core/services/sms-template.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import {
  PLACEHOLDER_MAP,
  VALID_PLACEHOLDER_FIELDS,
} from '../../../../shared/constants/sms-template-placeholders.constant';

interface TemplateSegment {
  type: 'text' | 'var';
  content: string;
  field: string;
  valid: boolean;
}

@Component({
  selector: 'app-sms-template-form',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
    TagModule,
    Popover,
  ],
  templateUrl: './sms-template-form.html',
  styleUrl: './sms-template-form.css',
})
export class SmsTemplateForm implements OnInit {
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private smsTemplateService = inject(SmsTemplateService);
  private errorHandler = inject(ErrorHandlerService);

  @ViewChild('replacerOp') replacerOp!: Popover;

  isEditMode = signal(false);
  isSubmitting = signal(false);

  private eventId!: number;
  private templateId: number | null = null;
  templateValue = signal('');
  activeReplaceField = signal<string | null>(null);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly pickerOptions = Object.entries(PLACEHOLDER_MAP).map(([field, label]) => ({
    field,
    label,
  }));

  formData: { name: string; smsTemplateId: string; template: string; note: string } = {
    name: '',
    smsTemplateId: '',
    template: '',
    note: '',
  };

  segments = computed((): TemplateSegment[] => {
    const text = this.templateValue();
    const result: TemplateSegment[] = [];
    let lastIndex = 0;
    const regex = /#\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
          field: '',
          valid: false,
        });
      }
      const field = match[1];
      result.push({ type: 'var', content: '', field, valid: VALID_PLACEHOLDER_FIELDS.has(field) });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex), field: '', valid: false });
    }
    return result;
  });

  detectedVars = computed(() => {
    const matches = [...this.templateValue().matchAll(/#\{([^}]*)\}/g)];
    return [...new Set(matches.map((m) => m[1]))];
  });

  invalidVars = computed(() => this.detectedVars().filter((f) => !VALID_PLACEHOLDER_FIELDS.has(f)));
  hasInvalidVars = computed(() => this.invalidVars().length > 0);

  ngOnInit(): void {
    const data = this.config.data as { smsTemplate?: SmsTemplate; eventId: number };
    const t = data?.smsTemplate ?? null;
    this.eventId = data.eventId;
    this.templateId = t?.id ?? null;
    this.isEditMode.set(!!t);
    this.formData = {
      name: t?.name ?? '',
      smsTemplateId: t?.smsTemplateId ?? '',
      template: t?.template ?? '',
      note: t?.note ?? '',
    };
    this.templateValue.set(this.formData.template);
  }

  onTemplateChange(value: string): void {
    this.templateValue.set(value ?? '');
  }

  onVarChipClick(field: string, event: MouseEvent): void {
    this.activeReplaceField.set(field);
    this.replacerOp.show(event);
  }

  onPickReplacement(newField: string | null): void {
    if (newField === null) return;
    const oldField = this.activeReplaceField();
    if (oldField === null) return;
    const regex = new RegExp(`#\\{${this.escapeRegex(oldField)}\\}`, 'g');
    const updated = this.formData.template.replace(regex, `#{${newField}}`);
    this.formData.template = updated;
    this.templateValue.set(updated);
    this.replacerOp.hide();
    this.activeReplaceField.set(null);
  }

  onSubmit(form: NgForm): void {
    if (form.invalid || this.hasInvalidVars()) return;

    const payload = this.isEditMode()
      ? this.buildPatch(form)
      : ({ ...this.formData } as CreateSmsTemplateRequest);

    if (this.isEditMode() && !Object.keys(payload).length) {
      this.ref.close();
      return;
    }

    this.isSubmitting.set(true);

    const request$ = this.isEditMode()
      ? this.smsTemplateService.updateSmsTemplate(
          this.eventId,
          this.templateId!,
          payload as UpdateSmsTemplateRequest,
        )
      : this.smsTemplateService.createSmsTemplate(
          this.eventId,
          payload as CreateSmsTemplateRequest,
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
          this.isEditMode() ? 'Failed to update SMS template' : 'Failed to create SMS template',
        );
      },
    });
  }

  private buildPatch(form: NgForm): UpdateSmsTemplateRequest {
    return Object.fromEntries(
      Object.keys(this.formData)
        .filter((key) => form.controls[key]?.dirty)
        .map((key) => [key, this.formData[key as keyof typeof this.formData]]),
    ) as UpdateSmsTemplateRequest;
  }

  onCancel(): void {
    this.ref.close();
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
