import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import {
  SmsTemplate,
  SmsTemplateFilterPrefs,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../../../core/models/sms-template.model';
import { SmsTemplateService } from '../../../core/services/sms-template.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { SmsTemplateForm } from '../sms-template-form/sms-template-form';
import { SmsTemplateDetail } from '../sms-template-detail/sms-template-detail';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatDateTimePipe } from '../../../shared/pipes/format-date-time.pipe';
import { TableColumn } from '../../../shared/models/table-config.model';
import {
  SMS_TEMPLATE_COLUMNS,
  DEFAULT_SMS_TEMPLATE_COLUMNS,
  SMS_TEMPLATE_STATUS_OPTIONS,
} from '../../../shared/constants/sms-template-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../shared/utils/column.utils';

@Component({
  selector: 'app-sms-template-section',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    MultiSelectModule,
    SelectModule,
    DatePickerModule,
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
export class SmsTemplateSection implements OnInit, OnDestroy {
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
  readonly buttonSize = BUTTON_SIZE;
  readonly statusOptions = SMS_TEMPLATE_STATUS_OPTIONS;

  // Filter signals
  searchTerm = signal('');
  filterEnabled = signal<boolean | null>(null);
  filterFromDate = signal<Date | null>(null);
  filterToDate = signal<Date | null>(null);

  // Toggle loading state
  togglingTemplateId = signal<number | null>(null);

  hasActiveFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.filterEnabled() !== null ||
      this.filterFromDate() !== null ||
      this.filterToDate() !== null,
  );

  private dialogRef: DynamicDialogRef | null = null;
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    initializeColumnPreferences(
      SMS_TEMPLATE_COLUMNS,
      DEFAULT_SMS_TEMPLATE_COLUMNS,
      STORAGE_KEYS.SMS_TEMPLATE_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );
    this.loadFilterPreferences();

    this.searchSubject.pipe(debounceTime(500), distinctUntilChanged()).subscribe((value) => {
      this.searchTerm.set(value);
      if (value.trim().length === 0 || value.trim().length >= 2) {
        this.loadSmsTemplates();
      }
    });

    this.loadSmsTemplates();
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  onColumnSelectionChange(): void {
    saveColumnPreferences(this.selectedCols, STORAGE_KEYS.SMS_TEMPLATE_TABLE_COLUMNS);
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  onFilterChange(): void {
    this.saveFilterPreferences();
    this.loadSmsTemplates();
  }

  onClearFilters(): void {
    this.searchTerm.set('');
    this.filterEnabled.set(null);
    this.filterFromDate.set(null);
    this.filterToDate.set(null);
    this.saveFilterPreferences();
    this.loadSmsTemplates();
  }

  private loadFilterPreferences(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SMS_TEMPLATE_TABLE_FILTERS);
      if (saved) {
        const prefs = JSON.parse(saved) as SmsTemplateFilterPrefs;
        this.filterEnabled.set(prefs.enabled ?? null);
      }
    } catch {
      // ignore parse errors
    }
  }

  private saveFilterPreferences(): void {
    try {
      const prefs: SmsTemplateFilterPrefs = { enabled: this.filterEnabled() };
      localStorage.setItem(STORAGE_KEYS.SMS_TEMPLATE_TABLE_FILTERS, JSON.stringify(prefs));
    } catch {
      // ignore storage errors
    }
  }

  loadSmsTemplates(): void {
    this.isLoading.set(true);

    const params: Parameters<typeof this.smsTemplateService.getSmsTemplatesByEvent>[1] = {
      page: 0,
      size: 100,
    };

    const search = this.searchTerm().trim();
    if (search.length >= 2) {
      params.search = search;
    }

    const enabled = this.filterEnabled();
    if (enabled !== null) {
      params.enabled = enabled;
    }

    const fromDate = this.filterFromDate();
    if (fromDate) {
      params.fromDate = fromDate.toISOString();
    }

    const toDate = this.filterToDate();
    if (toDate) {
      params.toDate = toDate.toISOString();
    }

    this.smsTemplateService.getSmsTemplatesByEvent(this.eventId(), params).subscribe({
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
      message: `Are you sure you want to delete "${template.name}"?`,
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

  onToggleStatus(event: Event, template: SmsTemplate): void {
    const action = template.enabled ? 'disable' : 'enable';

    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: `Do you want to ${action} "${template.name}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: action === 'enable' ? 'Enable' : 'Disable',
        severity: action === 'enable' ? 'success' : 'warn',
      },
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      accept: () => {
        this.togglingTemplateId.set(template.id);
        this.smsTemplateService.toggleSmsTemplateEnabled(this.eventId(), template.id).subscribe({
          next: (updated) => {
            this.smsTemplates.update((list) =>
              list.map((t) => (t.id === updated.id ? updated : t)),
            );
            this.togglingTemplateId.set(null);
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: `SMS template ${updated.enabled ? 'enabled' : 'disabled'} successfully`,
            });
          },
          error: (error: unknown) => {
            this.togglingTemplateId.set(null);
            this.errorHandler.showError(error, 'Failed to toggle SMS template status');
          },
        });
      },
    });
  }

  onViewTemplate(template: SmsTemplate): void {
    this.dialogService.open(SmsTemplateDetail, {
      header: template.name,
      width: '560px',
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      data: { template },
    });
  }

  displayData(): SmsTemplate[] {
    if (this.isLoading()) {
      return Array(5).fill({} as SmsTemplate);
    }
    return this.smsTemplates();
  }

  truncateText(text: string, maxLength: number = 50): string {
    if (!text) return '--';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}
