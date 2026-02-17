import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import { SmsTemplate } from '../../../core/models/sms-template.model';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

@Component({
  selector: 'app-sms-template-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
    DatePickerModule,
  ],
  templateUrl: './sms-template-form.html',
  styleUrl: './sms-template-form.css',
})
export class SmsTemplateForm implements OnInit {
  private fb = inject(FormBuilder);
  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);

  smsTemplateForm!: FormGroup;
  isEditMode = signal(false);
  smsTemplate = signal<SmsTemplate | null>(null);

  readonly inputSize = FORM_INPUT_SIZE;

  ngOnInit(): void {
    this.smsTemplate.set(this.config.data?.smsTemplate || null);
    this.isEditMode.set(!!this.smsTemplate());
    this.initForm();
  }

  initForm(): void {
    const template = this.smsTemplate();

    this.smsTemplateForm = this.fb.group({
      smsTemplateId: [
        template?.smsTemplateId || '',
        [
          Validators.required,
          Validators.minLength(20),
          Validators.maxLength(200),
          Validators.pattern('^[0-9]+$'),
        ],
      ],
      template: [
        template?.template || '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(1000)],
      ],
      note: [template?.note || '', [Validators.maxLength(500)]],
      scheduledDateTime: [
        template?.scheduledDateTime ? new Date(template.scheduledDateTime) : null,
        [],
      ],
    });
  }

  onSubmit(): void {
    if (this.smsTemplateForm.valid) {
      const formValue = { ...this.smsTemplateForm.value };

      // Convert Date to ISO string if present
      if (formValue.scheduledDateTime) {
        formValue.scheduledDateTime = formValue.scheduledDateTime.toISOString();
      }

      this.ref.close(formValue);
    }
  }

  onCancel(): void {
    this.ref.close();
  }
}
