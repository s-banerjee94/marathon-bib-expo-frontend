import { Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import {
  SmsTemplate,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../../../core/models/sms-template.model';
import { SmsTemplateService } from '../../../core/services/sms-template.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { SmsTemplateForm } from '../sms-template-form/sms-template-form';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatDateTimePipe } from '../../../shared/pipes/format-date-time.pipe';
import { TableColumn } from '../../../shared/models/table-config.model';
import { SMS_TEMPLATE_COLUMNS } from '../../../shared/constants/sms-template-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../shared/utils/column.utils';

const DEFAULT_SMS_TEMPLATE_FIELDS = [
  'id',
  'smsTemplateId',
  'template',
  'note',
  'scheduledDateTime',
  'enabled',
];

@Component({
  selector: 'app-sms-template-section',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    MultiSelectModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ConfirmPopupModule,
    DefaultValuePipe,
    FormatDateTimePipe,
  ],
  providers: [DialogService, ConfirmationService, MessageService],
  templateUrl: './sms-template-section.html',
  styleUrl: './sms-template-section.css',
})
export class SmsTemplateSection implements OnInit {
  eventId = input.required<number>();

  private smsTemplateService = inject(SmsTemplateService);
  private errorHandler = inject(ErrorHandlerService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  smsTemplates = signal<SmsTemplate[]>([]);
  isLoading = signal(true);

  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  readonly inputSize = FORM_INPUT_SIZE;

  private dialogRef: DynamicDialogRef | null = null;

  ngOnInit(): void {
    initializeColumnPreferences(
      SMS_TEMPLATE_COLUMNS,
      DEFAULT_SMS_TEMPLATE_FIELDS,
      STORAGE_KEYS.SMS_TEMPLATE_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );
    this.loadSmsTemplates();
  }

  onColumnSelectionChange(): void {
    saveColumnPreferences(this.selectedCols, STORAGE_KEYS.SMS_TEMPLATE_TABLE_COLUMNS);
  }

  loadSmsTemplates(): void {
    this.isLoading.set(true);
    this.smsTemplateService
      .getSmsTemplatesByEvent(this.eventId(), {
        page: 0,
        size: 100,
      })
      .subscribe({
        next: (response) => {
          this.smsTemplates.set(response.content);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.errorHandler.showError(error, 'Failed to load SMS templates');
          this.isLoading.set(false);
        },
      });
  }

  onCreate(): void {
    this.dialogRef = this.dialogService.open(SmsTemplateForm, {
      header: 'Create SMS Template',
      width: '600px',
      data: { smsTemplate: null },
    });

    this.dialogRef?.onClose.subscribe((result: unknown) => {
      if (result) {
        this.isLoading.set(true);
        const request = result as CreateSmsTemplateRequest;
        this.smsTemplateService.createSmsTemplate(this.eventId(), request).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'SMS template created successfully',
            });
            this.loadSmsTemplates();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to create SMS template');
            this.isLoading.set(false);
          },
        });
      }
    });
  }

  onEdit(template: SmsTemplate): void {
    this.dialogRef = this.dialogService.open(SmsTemplateForm, {
      header: 'Edit SMS Template',
      width: '600px',
      data: { smsTemplate: template },
    });

    this.dialogRef?.onClose.subscribe((result: unknown) => {
      if (result) {
        this.isLoading.set(true);
        const request = result as UpdateSmsTemplateRequest;
        this.smsTemplateService.updateSmsTemplate(this.eventId(), template.id, request).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'SMS template updated successfully',
            });
            this.loadSmsTemplates();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to update SMS template');
            this.isLoading.set(false);
          },
        });
      }
    });
  }

  onDelete(template: SmsTemplate, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to delete "${template.smsTemplateId}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-sm',
      accept: () => {
        this.isLoading.set(true);
        this.smsTemplateService.deleteSmsTemplate(this.eventId(), template.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'SMS template deleted successfully',
            });
            this.loadSmsTemplates();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to delete SMS template');
            this.isLoading.set(false);
          },
        });
      },
    });
  }

  onToggleStatus(template: SmsTemplate): void {
    const newStatus = !template.enabled;
    this.smsTemplateService.toggleSmsTemplateEnabled(this.eventId(), template.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `SMS template ${newStatus ? 'enabled' : 'disabled'} successfully`,
        });
        this.loadSmsTemplates();
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to update SMS template status');
      },
    });
  }

  truncateText(text: string, maxLength: number = 50): string {
    if (!text) return '--';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}
