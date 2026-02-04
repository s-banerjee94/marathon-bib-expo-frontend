import { Component, computed, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  ImportErrorItem,
  ImportHistoryItem,
  Participant,
} from '../../core/models/participant.model';
import { ParticipantService } from '../../core/services/participant.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { EventSelector } from '../../components/event-selector/event-selector';
import { ParticipantForm } from '../participant-form/participant-form';
import { PARTICIPANT_COLUMNS } from '../../shared/constants/participant-columns.constant';
import { TableColumn } from '../../shared/models/table-config.model';

// Child components
import { ParticipantTableTab } from './components/participant-table-tab/participant-table-tab';
import { ImportHistoryTab } from './components/import-history-tab/import-history-tab';
import { ParticipantViewDialog } from './components/participant-view-dialog/participant-view-dialog';
import { ParticipantExportDialog } from './components/participant-export-dialog/participant-export-dialog';
import {
  ImportResponse,
  ParticipantImportDialog,
} from './components/participant-import-dialog/participant-import-dialog';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.css',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TabsModule,
    DialogModule,
    ButtonModule,
    ConfirmDialogModule,
    OrganizationSelector,
    EventSelector,
    ParticipantForm,
    ParticipantTableTab,
    ImportHistoryTab,
    ParticipantViewDialog,
    ParticipantExportDialog,
    ParticipantImportDialog,
  ],
  providers: [DialogService, ConfirmationService],
})
export class ParticipantList implements OnInit, OnDestroy {
  @ViewChild(EventSelector) eventSelector?: EventSelector;
  @ViewChild('participantFormComponent') participantFormComponent?: ParticipantForm;
  // Cascading filter signals
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);
  // User role signals
  isOrganizerUser = signal(false);
  // Tab state
  activeTab = signal<string>('manage');
  // Participant table state
  participants = signal<Participant[]>([]);
  isLoading = signal(false);
  hasMore = signal(true);
  // Import dialog state
  showImportDialog = signal(false);
  isUploading = signal(false);
  currentImportId = signal<string | undefined>(undefined);
  importResponse = signal<ImportResponse | null>(null);
  errorDetails = signal<ImportErrorItem[]>([]);
  isLoadingErrors = signal(false);
  // Import history state
  importHistory = signal<ImportHistoryItem[]>([]);
  isLoadingHistory = signal(false);
  selectedImportId = signal<string | undefined>(undefined);
  importHistoryErrors = signal<ImportErrorItem[]>([]);
  isLoadingImportErrors = signal(false);
  hasMoreImportErrors = signal(true);
  // View details dialog state
  showViewDialog = signal(false);
  viewParticipant = signal<Participant | null>(null);
  // Create/Edit form dialog state
  showFormDialog = signal(false);
  formDialogHeader = signal('');
  formDialogData = signal<{
    eventId: number;
    bibNumber?: string;
    isEditMode: boolean;
  } | null>(null);
  // Export dialog state
  showExportDialog = signal(false);
  isExporting = signal(false);
  // Column configuration
  allColumns = PARTICIPANT_COLUMNS;
  visibleColumns = signal<string[]>([
    'bibNumber',
    'chipNumber',
    'fullName',
    'raceName',
    'categoryName',
    'gender',
    'email',
    'phoneNumber',
    'city',
    'actions',
  ]);
  // Computed: Show table only when organization and event are selected
  canShowTable = computed(
    () => this.selectedOrganizationId() !== undefined && this.selectedEventId() !== undefined,
  );
  private participantService = inject(ParticipantService);
  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);
  private confirmationService = inject(ConfirmationService);
  private dialogRef: DynamicDialogRef | null = null;
  private lastEvaluatedKey?: string;
  private lastEvaluatedKeyImportErrors?: string;

  ngOnInit(): void {
    // Check if user is ORGANIZER_ADMIN or ORGANIZER_USER
    const isOrgUser = this.authService.hasAnyRole([
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]);
    this.isOrganizerUser.set(isOrgUser);

    // If organizer user, automatically set organization ID from current user
    if (isOrgUser) {
      const currentUser = this.authService.currentUser();
      if (currentUser?.organizationId) {
        this.selectedOrganizationId.set(currentUser.organizationId);
      }
    }
  }

  onOrganizationChange(organizationId: number | undefined): void {
    this.selectedOrganizationId.set(organizationId);
    if (this.eventSelector) {
      this.eventSelector.reset();
    }
    this.selectedEventId.set(undefined);
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
  }

  onEventChange(eventId: number | undefined): void {
    this.selectedEventId.set(eventId);
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.resetImport();

    if (eventId) {
      this.loadParticipants();
      this.loadImportHistory();
    }
  }

  loadMore(): void {
    if (this.hasMore() && !this.isLoading()) {
      this.loadParticipants(true);
    }
  }

  // View dialog
  openViewDialog(participant: Participant): void {
    this.viewParticipant.set(participant);
    this.showViewDialog.set(true);
  }

  // Create/Edit form dialog
  openCreateDialog(): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;

    this.formDialogHeader.set('Create Participant');
    this.formDialogData.set({ eventId, isEditMode: false });
    this.showFormDialog.set(true);
  }

  openEditDialog(participant: Participant): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;

    this.formDialogHeader.set('Edit Participant');
    this.formDialogData.set({ eventId, bibNumber: participant.bibNumber, isEditMode: true });
    this.showFormDialog.set(true);
  }

  closeFormDialog(): void {
    this.showFormDialog.set(false);
    this.formDialogData.set(null);
  }

  submitFormDialog(): void {
    this.participantFormComponent?.submitForm();
  }

  onFormSubmitSuccess(): void {
    const isEditMode = this.formDialogData()?.isEditMode;
    const message = isEditMode
      ? 'Participant updated successfully'
      : 'Participant created successfully';

    this.errorHandler.showSuccess(message, 'Success');
    this.closeFormDialog();
    this.reloadParticipants();
  }

  deleteParticipant(participant: Participant): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete participant ${participant.fullName} (BIB: ${participant.bibNumber})?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const eventId = this.selectedEventId();
        if (!eventId) return;

        this.participantService.deleteParticipant(eventId, participant.bibNumber).subscribe({
          next: () => {
            this.errorHandler.showSuccess('Participant deleted successfully', 'Success');
            this.reloadParticipants();
          },
          error: (error) => {
            this.errorHandler.showError(error, 'Failed to delete participant');
          },
        });
      },
    });
  }

  // Export functionality
  openExportDialog(): void {
    this.showExportDialog.set(true);
  }

  confirmExport(columns: TableColumn[]): void {
    const eventId = this.selectedEventId();
    if (!eventId || columns.length === 0) return;

    this.isExporting.set(true);
    const fields = columns.map((col) => col.field);

    this.participantService.exportParticipants(eventId, fields).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `participants_event_${eventId}_${new Date().getTime()}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);

        this.isExporting.set(false);
        this.showExportDialog.set(false);
        this.errorHandler.showSuccess('Participants exported successfully', 'Success');
      },
      error: (error) => {
        this.isExporting.set(false);
        this.errorHandler.showError(error, 'Failed to export participants');
      },
    });
  }

  // Import functionality
  openImportDialog(): void {
    this.showImportDialog.set(true);
    this.importResponse.set(null);
  }

  handleImport(file: File): void {
    const eventId = this.selectedEventId();
    if (!eventId || !file) return;

    this.isUploading.set(true);
    this.importResponse.set(null);
    this.currentImportId.set(undefined);

    this.participantService.importParticipants(eventId, file).subscribe({
      next: (response) => {
        this.isUploading.set(false);
        this.currentImportId.set(response.importId);
        this.importResponse.set({
          success: true,
          message: response.message,
          totalRows: response.totalRows,
          successCount: response.successCount,
          failureCount: response.failureCount,
        });
        this.loadImportHistory();
      },
      error: (error) => {
        this.isUploading.set(false);
        this.importResponse.set({
          success: false,
          message: this.errorHandler.getErrorMessage(error),
        });
      },
    });
  }

  viewImportErrors(): void {
    const eventId = this.selectedEventId();
    const importId = this.currentImportId();
    if (!eventId || !importId) return;

    this.isLoadingErrors.set(true);
    this.errorDetails.set([]);

    this.participantService.getImportErrors(eventId, importId).subscribe({
      next: (response) => {
        this.isLoadingErrors.set(false);
        this.errorDetails.set(response.errors || []);
      },
      error: (error) => {
        this.isLoadingErrors.set(false);
        this.errorHandler.showError(error, 'Failed to load error details');
      },
    });
  }

  resetImport(): void {
    this.importResponse.set(null);
    this.currentImportId.set(undefined);
  }

  onImportDialogClosed(): void {
    const wasSuccessful = this.importResponse()?.success;
    this.resetImport();
    if (wasSuccessful) {
      this.reloadParticipants();
    }
  }

  onImportSelect(importId: string | undefined): void {
    this.selectedImportId.set(importId);
    this.importHistoryErrors.set([]);
    this.hasMoreImportErrors.set(true);
    this.lastEvaluatedKeyImportErrors = undefined;

    if (importId) {
      const selectedImport = this.importHistory().find((imp) => imp.importId === importId);
      if (selectedImport && selectedImport.failureCount > 0) {
        this.loadImportErrors(false);
      }
    }
  }

  loadMoreImportErrors(): void {
    if (this.hasMoreImportErrors() && !this.isLoadingImportErrors()) {
      this.loadImportErrors(true);
    }
  }

  ngOnDestroy(): void {
    this.dialogRef?.close();
  }

  private loadParticipants(append: boolean = false): void {
    const eventId = this.selectedEventId();
    if (!eventId || this.isLoading()) return;

    this.isLoading.set(true);

    this.participantService
      .getParticipants(eventId, 50, append ? this.lastEvaluatedKey : undefined)
      .subscribe({
        next: (response) => {
          if (append) {
            this.participants.update((current) => [...current, ...response.participants]);
          } else {
            this.participants.set(response.participants);
          }
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load participants');
          this.isLoading.set(false);
        },
      });
  }

  private reloadParticipants(): void {
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.loadParticipants();
  }

  // Import history
  private loadImportHistory(): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;

    this.isLoadingHistory.set(true);

    this.participantService.getImportHistory(eventId, 0, 5).subscribe({
      next: (response) => {
        this.isLoadingHistory.set(false);
        this.importHistory.set(response.imports || []);
      },
      error: (error) => {
        this.isLoadingHistory.set(false);
        this.errorHandler.showError(error, 'Failed to load import history');
      },
    });
  }

  private loadImportErrors(append: boolean = false): void {
    const eventId = this.selectedEventId();
    const importId = this.selectedImportId();
    if (!eventId || !importId || this.isLoadingImportErrors()) return;

    this.isLoadingImportErrors.set(true);

    this.participantService
      .getImportErrors(
        eventId,
        importId,
        50,
        append ? this.lastEvaluatedKeyImportErrors : undefined,
      )
      .subscribe({
        next: (response) => {
          if (append) {
            this.importHistoryErrors.update((current) => [...current, ...(response.errors || [])]);
          } else {
            this.importHistoryErrors.set(response.errors || []);
          }
          this.lastEvaluatedKeyImportErrors = response.lastEvaluatedKey;
          this.hasMoreImportErrors.set(response.hasMore || false);
          this.isLoadingImportErrors.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load import errors');
          this.isLoadingImportErrors.set(false);
        },
      });
  }
}
