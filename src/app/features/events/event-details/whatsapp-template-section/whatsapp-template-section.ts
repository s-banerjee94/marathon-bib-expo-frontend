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
import { TagModule } from 'primeng/tag';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { WhatsAppTemplate } from '../../../../core/models/whatsapp-template.model';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { WhatsappTemplateForm } from '../whatsapp-template-form/whatsapp-template-form';
import { WhatsappTemplateDetail } from '../whatsapp-template-detail/whatsapp-template-detail';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { TruncatePipe } from '../../../../shared/pipes/truncate-pipe';
import { TableColumn } from '../../../../shared/models/table-config.model';
import {
  WHATSAPP_TEMPLATE_COLUMNS,
  DEFAULT_WHATSAPP_TEMPLATE_COLUMNS,
} from '../../../../shared/constants/whatsapp-template-columns.constant';
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
  selector: 'app-whatsapp-template-section',
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
    TagModule,
    ConfirmPopupModule,
    CardModule,
    DefaultValuePipe,
    TruncatePipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './whatsapp-template-section.html',
  styleUrl: './whatsapp-template-section.css',
})
export class WhatsappTemplateSection implements OnInit, OnDestroy {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private whatsAppService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private storage = inject(LocalStorageService);

  templates = signal<WhatsAppTemplate[]>([]);
  isLoading = signal(true);
  isMobile = injectIsMobile();
  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  visibleCols = computed(() => getVisibleCols(WHATSAPP_TEMPLATE_COLUMNS, this.selectedCols()));
  displayData = computed(() =>
    this.isLoading() ? (Array(5).fill({}) as WhatsAppTemplate[]) : this.templates(),
  );
  searchTerm = signal('');

  readonly inputSize = FORM_INPUT_SIZE;
  readonly buttonSize = BUTTON_SIZE;

  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    initializeColumnPreferences(
      this.storage,
      WHATSAPP_TEMPLATE_COLUMNS,
      DEFAULT_WHATSAPP_TEMPLATE_COLUMNS,
      STORAGE_KEYS.WHATSAPP_TEMPLATE_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );

    this.searchSubject.pipe(debounceTime(500), distinctUntilChanged()).subscribe((value) => {
      this.searchTerm.set(value);
      if (value.trim().length === 0 || value.trim().length >= 2) {
        this.loadTemplates();
      }
    });

    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  onColumnSelectionChange(): void {
    enforceRequiredColumns(this.selectedCols, WHATSAPP_TEMPLATE_COLUMNS);
    saveColumnPreferences(
      this.storage,
      this.selectedCols,
      STORAGE_KEYS.WHATSAPP_TEMPLATE_TABLE_COLUMNS,
    );
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  onClearSearch(): void {
    this.searchTerm.set('');
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.isLoading.set(true);
    this.whatsAppService.getTemplatesByEvent(this.eventId(), this.searchTerm()).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load WhatsApp templates');
        this.isLoading.set(false);
      },
    });
  }

  onCreate(): void {
    const ref = this.dialogService.open(WhatsappTemplateForm, {
      header: 'Create WhatsApp Template',
      width: '640px',
      data: { whatsAppTemplate: null, eventId: this.eventId() },
    });

    ref?.onClose.subscribe((result: WhatsAppTemplate | undefined) => {
      if (result) {
        this.templates.update((list) => [result, ...list]);
        this.toast.success('WhatsApp template created successfully');
      }
    });
  }

  onEdit(template: WhatsAppTemplate): void {
    const ref = this.dialogService.open(WhatsappTemplateForm, {
      header: 'Edit WhatsApp Template',
      width: '640px',
      data: { whatsAppTemplate: template, eventId: this.eventId() },
    });

    ref?.onClose.subscribe((result: WhatsAppTemplate | undefined) => {
      if (result) {
        this.templates.update((list) => list.map((t) => (t.id === result.id ? result : t)));
        this.toast.success('WhatsApp template updated successfully');
      }
    });
  }

  onDelete(template: WhatsAppTemplate, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to delete "${template.name}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.whatsAppService.deleteTemplate(this.eventId(), template.id).subscribe({
          next: () => {
            this.templates.update((list) => list.filter((t) => t.id !== template.id));
            this.toast.success('WhatsApp template deleted successfully');
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error);
          },
        });
      },
    });
  }

  onViewTemplate(template: WhatsAppTemplate): void {
    this.dialogService.open(WhatsappTemplateDetail, {
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
