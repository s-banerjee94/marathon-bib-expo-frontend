import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import {
  BatchJobStatusResponse,
  ImportErrorItem,
  Participant,
} from '../../core/models/participant.model';
import { ParticipantService } from '../../core/services/participant.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { EventSelector } from '../../components/event-selector/event-selector';
import { ParticipantForm } from '../participant-form/participant-form';
import {
  PARTICIPANT_COLUMNS,
  BULK_DELETE_MAX_LIMIT,
} from '../../shared/constants/participant-columns.constant';
import { PAGINATION_LIMIT } from '../../shared/constants/form.constants';
import { LookupSearchType } from '../../core/models/participant.model';
import { TableColumn } from '../../shared/models/table-config.model';

// Child components
import { ParticipantTableTab } from './components/participant-table-tab/participant-table-tab';
import { ImportHistoryTab } from './components/import-history-tab/import-history-tab';
import { ParticipantViewDialog } from './components/participant-view-dialog/participant-view-dialog';
import { ParticipantExportDialog } from './components/participant-export-dialog/participant-export-dialog';
import { ParticipantImportDialog } from './components/participant-import-dialog/participant-import-dialog';

@Component({
  selector: 'app-participant-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.css',
  imports: [
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
  providers: [ConfirmationService],
})
export class ParticipantList implements OnInit {
  private readonly eventSelector = viewChild(EventSelector);
  private readonly participantFormComponent = viewChild<ParticipantForm>(
    'participantFormComponent',
  );
  private readonly participantTableTab = viewChild(ParticipantTableTab);
  // Cascading filter signals
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);
  // User role signals
  isOrganizerUser = signal(false);
  // Tab state
  activeTab = signal<string>('manage');
  // Participant table state
  participants = signal<Participant[]>([]);
  totalCount = signal<number>(0);
  isLoading = signal(false);
  hasMore = signal(true);
  // Import dialog state
  showImportDialog = signal(false);
  isUploading = signal(false);
  batchJobStatus = signal<BatchJobStatusResponse | null>(null);
  private pollingInterval: ReturnType<typeof setTimeout> | null = null;
  // Latest import errors state
  importErrors = signal<ImportErrorItem[]>([]);
  isLoadingImportErrors = signal(false);
  hasMoreImportErrors = signal(false);
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
  // Lookup state (for pagination)
  selectedSearchType = signal<LookupSearchType>('NAME');
  searchValue = signal<string>('');
  isSearchMode = signal<boolean>(false);
  // Column configuration
  allColumns = PARTICIPANT_COLUMNS;
  // Computed: Show table only when organization and event are selected
  canShowTable = computed(
    () => this.selectedOrganizationId() !== undefined && this.selectedEventId() !== undefined,
  );
  private readonly participantService = inject(ParticipantService);
  private readonly authService = inject(AuthService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private lastEvaluatedKey?: string;
  private lastEvaluatedKeyImportErrors?: string;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopPolling());

    const isOrgUser = this.authService.hasAnyRole([
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]);
    this.isOrganizerUser.set(isOrgUser);

    if (isOrgUser) {
      const currentUser = this.authService.currentUser();
      if (currentUser?.organizationId) {
        this.selectedOrganizationId.set(currentUser.organizationId);
      }
    }
  }

  onOrganizationChange(organizationId: number | undefined): void {
    this.selectedOrganizationId.set(organizationId);
    this.eventSelector()?.reset();
    this.selectedEventId.set(undefined);
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
  }

  onEventChange(eventId: number | undefined): void {
    this.selectedEventId.set(eventId);
    this.participants.set([]);
    this.totalCount.set(0);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.resetImport();
    this.resetSearch();

    if (eventId) {
      this.loadParticipants();
      this.loadLatestImportErrors();
      this.loadTotalCount();
    }
  }

  resetSearch(): void {
    this.searchValue.set('');
    this.isSearchMode.set(false);
    this.selectedSearchType.set('NAME');
  }

  onSearchTypeChange(searchType: LookupSearchType): void {
    this.selectedSearchType.set(searchType);
  }

  performLookup(searchParams: { searchType: LookupSearchType; searchValue: string }): void {
    const eventId = this.selectedEventId();

    if (!eventId || !searchParams.searchValue || searchParams.searchValue.length < 2) {
      return;
    }

    // Store search params for pagination
    this.selectedSearchType.set(searchParams.searchType);
    this.searchValue.set(searchParams.searchValue);
    this.isSearchMode.set(true);
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.isLoading.set(true);

    this.participantService
      .lookupParticipants({
        eventId,
        searchType: searchParams.searchType,
        searchValue: searchParams.searchValue,
        limit: PAGINATION_LIMIT,
      })
      .subscribe({
        next: (response) => {
          this.participants.set(response.participants);
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to lookup participants');
          this.isLoading.set(false);
        },
      });
  }

  clearSearch(): void {
    this.resetSearch();
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.loadParticipants();
  }

  loadMore(): void {
    if (this.hasMore() && !this.isLoading()) {
      if (this.isSearchMode()) {
        this.loadMoreLookupResults();
      } else {
        this.loadParticipants(true);
      }
    }
  }

  private loadMoreLookupResults(): void {
    const eventId = this.selectedEventId();
    const searchValue = this.searchValue().trim();
    const searchType = this.selectedSearchType();

    if (!eventId || !searchValue || !this.lastEvaluatedKey) {
      return;
    }

    this.isLoading.set(true);

    this.participantService
      .lookupParticipants({
        eventId,
        searchType,
        searchValue,
        limit: PAGINATION_LIMIT,
        lastEvaluatedKey: this.lastEvaluatedKey,
      })
      .subscribe({
        next: (response) => {
          this.participants.update((current) => [...current, ...response.participants]);
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load more participants');
          this.isLoading.set(false);
        },
      });
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
    this.participantFormComponent()?.submitForm();
  }

  onFormSubmitSuccess(): void {
    const isEditMode = this.formDialogData()?.isEditMode;
    const message = isEditMode
      ? 'Participant updated successfully'
      : 'Participant created successfully';

    this.errorHandler.showSuccess(message, 'Success');
    this.closeFormDialog();

    if (!isEditMode) {
      // Increment total count only for create, not for edit
      this.totalCount.update((count) => count + 1);
    }

    this.reloadParticipants();
  }

  deleteParticipant(participant: Participant): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete participant ${participant.fullName} (BIB: ${participant.bibNumber})?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        const eventId = this.selectedEventId();
        if (!eventId) return;

        this.participantService.deleteParticipant(eventId, participant.bibNumber).subscribe({
          next: () => {
            this.errorHandler.showSuccess('Participant deleted successfully', 'Success');
            // Remove from local state instead of reloading from API
            this.removeParticipantFromList(participant.bibNumber);
            this.totalCount.update((count) => Math.max(0, count - 1));
            this.participantTableTab()?.clearSelection();
          },
          error: (error) => {
            this.errorHandler.showError(error, 'Failed to delete participant');
          },
        });
      },
    });
  }

  bulkDeleteParticipants(participants: Participant[]): void {
    const count = participants.length;

    if (count === 0) return;

    if (count > BULK_DELETE_MAX_LIMIT) {
      this.errorHandler.showError(
        { message: `Maximum ${BULK_DELETE_MAX_LIMIT} participants can be deleted at once` },
        'Too Many Participants',
      );
      return;
    }

    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${count} participant(s)? This action cannot be undone.`,
      header: 'Confirm Bulk Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        const eventId = this.selectedEventId();
        if (!eventId) return;

        const bibNumbers = participants.map((p) => p.bibNumber);

        this.participantService.bulkDeleteParticipants(eventId, bibNumbers).subscribe({
          next: (response) => {
            const message =
              response.failedCount > 0
                ? `${response.deletedCount} participant(s) deleted, ${response.failedCount} failed`
                : `${response.deletedCount} participant(s) deleted successfully`;

            this.errorHandler.showSuccess(message, 'Success');
            // Remove deleted participants from local state instead of reloading from API
            this.removeParticipantsFromList(bibNumbers);
            this.totalCount.update((count) => Math.max(0, count - response.deletedCount));
            this.participantTableTab()?.clearSelection();
          },
          error: (error) => {
            this.errorHandler.showError(error, 'Failed to delete participants');
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
    this.batchJobStatus.set(null);
  }

  handleBatchImport(file: File): void {
    const eventId = this.selectedEventId();
    if (!eventId || !file) return;

    this.isUploading.set(true);
    this.batchJobStatus.set(null);

    this.participantService.launchBatchImport(eventId, file).subscribe({
      next: (response) => {
        this.isUploading.set(false);
        this.startPolling(eventId, response.jobExecutionId);
      },
      error: (error) => {
        this.isUploading.set(false);
        this.errorHandler.showError(error, 'Failed to launch import job');
      },
    });
  }

  resetImport(): void {
    this.stopPolling();
    this.batchJobStatus.set(null);
  }

  onImportDialogClosed(): void {
    const status = this.batchJobStatus()?.status;
    const isTerminal = status === 'COMPLETED' || status === 'FAILED' || status === 'STOPPED';

    if (isTerminal) {
      this.stopPolling();
      if (status === 'COMPLETED') {
        this.reloadParticipants();
        this.loadLatestImportErrors();
      }
    }
    // If still processing: polling continues in background.
    // startPolling will reload + show a toast when the job finishes.
    this.batchJobStatus.set(null);
  }

  loadMoreImportErrors(): void {
    if (this.hasMoreImportErrors() && !this.isLoadingImportErrors()) {
      this.loadLatestImportErrors(true);
    }
  }

  private startPolling(eventId: number, jobExecutionId: number): void {
    this.stopPolling();

    const poll = (): void => {
      this.participantService
        .getBatchImportStatus(eventId, jobExecutionId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (status) => {
            this.batchJobStatus.set(status);
            if (
              status.status === 'COMPLETED' ||
              status.status === 'FAILED' ||
              status.status === 'STOPPED'
            ) {
              this.stopPolling();
              if (status.status === 'COMPLETED') {
                this.reloadParticipants();
                this.loadLatestImportErrors();
                // Show toast only when dialog is already closed (background completion)
                if (!this.showImportDialog()) {
                  this.errorHandler.showSuccess('Import completed successfully', 'Import Complete');
                }
              }
            } else {
              // Schedule next poll only after this response arrives (prevents concurrent requests)
              this.pollingInterval = setTimeout(poll, 2000);
            }
          },
          error: (error) => {
            this.stopPolling();
            this.errorHandler.showError(error, 'Failed to get import status');
          },
        });
    };

    poll();
  }

  private stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private loadParticipants(append: boolean = false): void {
    const eventId = this.selectedEventId();
    if (!eventId || this.isLoading()) return;

    this.isLoading.set(true);

    this.participantService
      .getParticipants(eventId, PAGINATION_LIMIT, append ? this.lastEvaluatedKey : undefined)
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
    this.participantTableTab()?.clearSelection();
    this.loadParticipants();
    this.loadTotalCount();
  }

  private loadTotalCount(): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;

    this.participantService.getParticipantCount(eventId).subscribe({
      next: (response) => {
        this.totalCount.set(response.count);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load participant count');
      },
    });
  }

  private loadLatestImportErrors(append: boolean = false): void {
    const eventId = this.selectedEventId();
    if (!eventId || this.isLoadingImportErrors()) return;

    if (!append) {
      this.importErrors.set([]);
      this.hasMoreImportErrors.set(false);
      this.lastEvaluatedKeyImportErrors = undefined;
    }

    this.isLoadingImportErrors.set(true);

    this.participantService
      .getLatestBatchImportErrors(
        eventId,
        50,
        append ? this.lastEvaluatedKeyImportErrors : undefined,
      )
      .subscribe({
        next: (response) => {
          if (append) {
            this.importErrors.update((current) => [...current, ...(response.errors ?? [])]);
          } else {
            this.importErrors.set(response.errors ?? []);
          }
          this.lastEvaluatedKeyImportErrors = response.lastEvaluatedKey;
          this.hasMoreImportErrors.set(response.hasMore ?? false);
          this.isLoadingImportErrors.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load import errors');
          this.isLoadingImportErrors.set(false);
        },
      });
  }

  // Helper methods to remove participants from local state (avoids unnecessary API calls)
  private removeParticipantFromList(bibNumber: string): void {
    this.participants.update((current) => current.filter((p) => p.bibNumber !== bibNumber));
  }

  private removeParticipantsFromList(bibNumbers: string[]): void {
    const bibNumberSet = new Set(bibNumbers);
    this.participants.update((current) => current.filter((p) => !bibNumberSet.has(p.bibNumber)));
  }
}
