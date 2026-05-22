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
import {
  ActivatedRoute,
  NavigationEnd,
  ParamMap,
  Params,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ImportErrorItem, Participant } from '../../core/models/participant.model';
import { ParticipantService } from '../../core/services/participant.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
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
import {
  ParticipantListBus,
  ParticipantMutation,
} from '../participants/participant-list-bus.service';

// Child components
import { ParticipantTableTab } from './components/participant-table-tab/participant-table-tab';
import { ImportHistoryTab } from './components/import-history-tab/import-history-tab';
import { ParticipantViewDialog } from './components/participant-view-dialog/participant-view-dialog';
import { ParticipantExportDialog } from './components/participant-export-dialog/participant-export-dialog';
import { ParticipantImportDialog } from './components/participant-import-dialog/participant-import-dialog';
import { ImportProgressService } from '../../core/services/import-progress.service';

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
    RouterOutlet,
  ],
  providers: [ConfirmationService],
})
export class ParticipantList implements OnInit {
  private readonly importProgress = inject(ImportProgressService);
  private readonly eventSelector = viewChild(EventSelector);
  private readonly participantFormComponent = viewChild<ParticipantForm>(
    'participantFormComponent',
  );
  private readonly participantTableTab = viewChild(ParticipantTableTab);
  // Cascading filter signals (URL-synced)
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
  // Mirrors the form's isSubmitDisabled() so the dialog footer button can disable until validation passes.
  formSubmitDisabled = signal<boolean>(true);
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
  // Viewport tracking: on mobile the form renders full-page via <router-outlet />;
  // on desktop the same URL opens the form in the existing p-dialog.
  private mediaQuery = window.matchMedia('(max-width: 768px)');
  isMobile = signal(this.mediaQuery.matches);
  hasFormRoute = signal(false);
  // Tracks which dialog is currently driven by the URL: null = closed, 'new' = create,
  // 'edit:<eventId>:<bib>' = edit. Used to ignore router events that don't change dialog state.
  private dialogKey: string | null = null;
  // True when the dialog is being closed by syncDialogToRoute (URL change),
  // so onFormDialogVisibleChange skips its own URL-clearing navigation.
  private closingDialogFromRoute = false;
  private readonly participantService = inject(ParticipantService);
  private readonly authService = inject(AuthService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly participantListBus = inject(ParticipantListBus);
  private lastEvaluatedKey?: string;
  private lastEvaluatedKeyImportErrors?: string;

  ngOnInit(): void {
    this.importProgress.completed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evt) => {
      if (evt.eventId !== this.selectedEventId()) return;
      if (evt.status === 'COMPLETED') {
        this.reloadParticipants();
        this.loadLatestImportErrors();
      }
    });

    const isOrgUser = this.authService.hasAnyRole([
      UserRole.ORGANIZER_ADMIN,
      UserRole.ORGANIZER_USER,
    ]);
    this.isOrganizerUser.set(isOrgUser);

    // Viewport tracking — re-sync dialog state on viewport changes so a desktop dialog
    // tears down when the user shrinks to mobile (and vice versa).
    const onViewportChange = (event: MediaQueryListEvent) => {
      this.isMobile.set(event.matches);
      this.syncDialogToRoute();
    };
    this.mediaQuery.addEventListener('change', onViewportChange);
    this.destroyRef.onDestroy(() => {
      this.mediaQuery.removeEventListener('change', onViewportChange);
    });

    // React to URL changes (route segments) to open/close the form dialog.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncDialogToRoute());

    // Apply data mutations published by the form (created/updated) without an extra HTTP fetch.
    this.participantListBus.mutations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mutation) => this.applyParticipantMutation(mutation));

    // URL is the source of truth for the org/event filters. queryParamMap emits synchronously
    // on subscribe, which seeds the initial state (including bookmarked deep-links).
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyUrlToState(params));

    // If an org user landed without URL filters, seed the URL with their org so links stay shareable.
    if (isOrgUser && !this.route.snapshot.queryParamMap.get('organizationId')) {
      const orgId = this.authService.currentUser()?.organizationId;
      if (orgId) {
        this.pushStateToUrl({ organizationId: String(orgId) });
      }
    }

    // Initial dialog sync so deep-linked /participants/new (or /:eventId/:bib/edit) opens immediately.
    this.syncDialogToRoute();
  }

  private applyUrlToState(params: ParamMap): void {
    const orgIdParam = params.get('organizationId');
    const eventIdParam = params.get('eventId');

    const orgId =
      orgIdParam && Number.isFinite(Number(orgIdParam)) ? Number(orgIdParam) : undefined;
    const eventId =
      eventIdParam && Number.isFinite(Number(eventIdParam)) ? Number(eventIdParam) : undefined;

    const prevOrgId = this.selectedOrganizationId();
    const prevEventId = this.selectedEventId();

    this.selectedOrganizationId.set(orgId);
    this.selectedEventId.set(eventId);

    if (orgId !== prevOrgId) {
      // Reset event selector UI when organization changes.
      this.eventSelector()?.reset();
    }

    if (eventId !== prevEventId) {
      this.participants.set([]);
      this.totalCount.set(0);
      this.hasMore.set(true);
      this.lastEvaluatedKey = undefined;
      this.resetSearch();
      if (eventId) {
        this.loadParticipants();
        this.loadLatestImportErrors();
        this.loadTotalCount();
      }
    }
  }

  onOrganizationChange(organizationId: number | undefined): void {
    this.pushStateToUrl({
      organizationId: organizationId != null ? String(organizationId) : null,
      eventId: null,
    });
  }

  onEventChange(eventId: number | undefined): void {
    this.pushStateToUrl({
      eventId: eventId != null ? String(eventId) : null,
    });
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

  onFormSubmitDisabledChange(disabled: boolean): void {
    this.formSubmitDisabled.set(disabled);
  }

  // Create button — navigate to the create route; syncDialogToRoute opens the dialog (desktop)
  // or the router-outlet renders the full-page form (mobile).
  openCreateDialog(): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    this.router.navigate(['/participants/new'], { queryParamsHandling: 'preserve' });
  }

  openEditDialog(participant: Participant): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    this.router.navigate(['/participants', eventId, participant.bibNumber, 'edit'], {
      queryParamsHandling: 'preserve',
    });
  }

  private openCreateDialogDirect(): void {
    const eventId = this.selectedEventId();
    if (!eventId) {
      // Deep-link without an event context — fall back to the list.
      this.router.navigate(['/participants'], { queryParamsHandling: 'preserve' });
      return;
    }
    this.formSubmitDisabled.set(true);
    this.formDialogHeader.set('Create Participant');
    this.formDialogData.set({ eventId, isEditMode: false });
    this.showFormDialog.set(true);
  }

  private openEditDialogDirect(eventId: number, bibNumber: string): void {
    this.formSubmitDisabled.set(true);
    this.formDialogHeader.set('Edit Participant');
    this.formDialogData.set({ eventId, bibNumber, isEditMode: true });
    this.showFormDialog.set(true);
  }

  closeFormDialog(): void {
    this.showFormDialog.set(false);
    this.formDialogData.set(null);
  }

  onFormDialogVisibleChange(visible: boolean): void {
    if (visible) return;
    this.closeFormDialog();
    // syncDialogToRoute initiated this close — URL is already moving, skip our own nav.
    if (this.closingDialogFromRoute) {
      this.closingDialogFromRoute = false;
      return;
    }
    // User-initiated close (X / overlay click) — clear the route segment.
    this.dialogKey = null;
    this.router.navigate(['/participants'], { queryParamsHandling: 'preserve' });
  }

  submitFormDialog(): void {
    this.participantFormComponent()?.submitForm();
  }

  onFormSubmitSuccess(): void {
    const isEditMode = this.formDialogData()?.isEditMode;
    const message = isEditMode
      ? 'Participant updated successfully'
      : 'Participant created successfully';

    this.toast.success(message, 'Success');
    // List data is already updated via the bus; just clear the route segment.
    this.router.navigate(['/participants'], { queryParamsHandling: 'preserve' });
  }

  private applyParticipantMutation(mutation: ParticipantMutation): void {
    const current = this.participants();
    if (mutation.action === 'created') {
      this.participants.set([mutation.participant, ...current]);
      this.totalCount.update((count) => count + 1);
    } else {
      const updated = current.map((p) =>
        p.bibNumber === mutation.participant.bibNumber ? mutation.participant : p,
      );
      this.participants.set(updated);
    }
  }

  private syncDialogToRoute(): void {
    const child = this.route.snapshot.firstChild;
    const segments = child?.url ?? [];
    let nextKey: string | null = null;

    if (segments.length === 1 && segments[0].path === 'new') {
      nextKey = 'new';
    } else if (segments.length === 3 && segments[2].path === 'edit') {
      // :eventId/:bib/edit
      nextKey = `edit:${segments[0].path}:${segments[1].path}`;
    }

    this.hasFormRoute.set(nextKey !== null);

    // Mobile renders the routed form via <router-outlet />; ensure any open dialog tears down.
    if (this.isMobile()) {
      if (this.dialogKey !== null && this.showFormDialog()) {
        this.closingDialogFromRoute = true;
        this.closeFormDialog();
      }
      this.dialogKey = null;
      return;
    }

    if (nextKey === this.dialogKey) return;

    const previousKey = this.dialogKey;
    this.dialogKey = nextKey;

    if (previousKey !== null && this.showFormDialog()) {
      this.closingDialogFromRoute = true;
      this.closeFormDialog();
    }

    if (nextKey === 'new') {
      this.openCreateDialogDirect();
    } else if (nextKey?.startsWith('edit:')) {
      const parts = nextKey.split(':');
      const eventId = Number(parts[1]);
      const bib = parts[2];
      if (Number.isFinite(eventId) && bib) {
        this.openEditDialogDirect(eventId, bib);
      }
    }
  }

  private pushStateToUrl(updates: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updates,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
            this.toast.success('Participant deleted successfully', 'Success');
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

            this.toast.success(message, 'Success');
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
        this.toast.success('Participants exported successfully', 'Success');
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
  }

  handleBatchImport(file: File): void {
    const eventId = this.selectedEventId();
    if (!eventId || !file) return;

    this.isUploading.set(true);

    this.participantService.launchBatchImport(eventId, file).subscribe({
      next: (response) => {
        this.isUploading.set(false);
        this.showImportDialog.set(false);
        this.importProgress.start(eventId, response.jobExecutionId);
      },
      error: (error) => {
        this.isUploading.set(false);
        this.errorHandler.showError(error, 'Failed to launch import job');
      },
    });
  }

  onImportDialogClosed(): void {
    // Polling is owned by the global progress service; nothing to tear down here.
  }

  loadMoreImportErrors(): void {
    if (this.hasMoreImportErrors() && !this.isLoadingImportErrors()) {
      this.loadLatestImportErrors(true);
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
