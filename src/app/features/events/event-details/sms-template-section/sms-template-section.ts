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
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { SmsTemplate } from '../../../../core/models/sms-template.model';
import { SmsTemplateService } from '../../../../core/services/sms-template.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { SmsTemplateForm } from '../sms-template-form/sms-template-form';
import { SmsTemplateDetail } from '../sms-template-detail/sms-template-detail';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { TruncatePipe } from '../../../../shared/pipes/truncate-pipe';
import { TableColumn } from '../../../../shared/models/table-config.model';
import {
  SMS_TEMPLATE_COLUMNS,
  DEFAULT_SMS_TEMPLATE_COLUMNS,
} from '../../../../shared/constants/sms-template-columns.constant';
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
    SkeletonModule,
    TooltipModule,
    ConfirmPopupModule,
    CardModule,
    DefaultValuePipe,
    TruncatePipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './sms-template-section.html',
  styleUrl: './sms-template-section.css',
})
export class SmsTemplateSection implements OnInit, OnDestroy {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private smsTemplateService = inject(SmsTemplateService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private storage = inject(LocalStorageService);

  smsTemplates = signal<SmsTemplate[]>([]);
  isLoading = signal(true);
  isMobile = injectIsMobile();
  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  visibleCols = computed(() => getVisibleCols(SMS_TEMPLATE_COLUMNS, this.selectedCols()));
  displayData = computed(() =>
    this.isLoading() ? (Array(5).fill({}) as SmsTemplate[]) : this.smsTemplates(),
  );
  searchTerm = signal('');

  readonly inputSize = FORM_INPUT_SIZE;
  readonly buttonSize = BUTTON_SIZE;

  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    initializeColumnPreferences(
      this.storage,
      SMS_TEMPLATE_COLUMNS,
      DEFAULT_SMS_TEMPLATE_COLUMNS,
      STORAGE_KEYS.SMS_TEMPLATE_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );

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
    enforceRequiredColumns(this.selectedCols, SMS_TEMPLATE_COLUMNS);
    saveColumnPreferences(this.storage, this.selectedCols, STORAGE_KEYS.SMS_TEMPLATE_TABLE_COLUMNS);
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  onClearSearch(): void {
    this.searchTerm.set('');
    this.loadSmsTemplates();
  }

  loadSmsTemplates(): void {
    this.isLoading.set(true);
    this.smsTemplateService.getSmsTemplatesByEvent(this.eventId(), this.searchTerm()).subscribe({
      next: (templates) => {
        this.smsTemplates.set(templates);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load SMS templates');
        this.isLoading.set(false);
      },
    });
  }

  onCreate(): void {
    const ref = this.dialogService.open(SmsTemplateForm, {
      header: 'Create SMS Template',
      width: '600px',
      data: { smsTemplate: null, eventId: this.eventId() },
    });

    ref?.onClose.subscribe((result: SmsTemplate | undefined) => {
      if (result) {
        this.smsTemplates.update((list) => [result, ...list]);
        this.toast.success('SMS template created successfully');
      }
    });
  }

  onEdit(template: SmsTemplate): void {
    const ref = this.dialogService.open(SmsTemplateForm, {
      header: 'Edit SMS Template',
      width: '600px',
      data: { smsTemplate: template, eventId: this.eventId() },
    });

    ref?.onClose.subscribe((result: SmsTemplate | undefined) => {
      if (result) {
        this.smsTemplates.update((list) => list.map((t) => (t.id === result.id ? result : t)));
        this.toast.success('SMS template updated successfully');
      }
    });
  }

  onDelete(template: SmsTemplate, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to delete "${template.name}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.smsTemplateService.deleteSmsTemplate(this.eventId(), template.id).subscribe({
          next: () => {
            this.smsTemplates.update((list) => list.filter((t) => t.id !== template.id));
            this.toast.success('SMS template deleted successfully');
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to delete SMS template');
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
}
