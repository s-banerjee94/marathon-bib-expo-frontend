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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  ParamMap,
  Params,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Participant } from '../../core/models/participant.model';
import { ParticipantService } from '../../core/services/participant.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { EventSelector } from '../../components/event-selector/event-selector';
import { ParticipantForm } from '../participant-form/participant-form';
import { PARTICIPANT_COLUMNS } from '../../shared/constants/participant-columns.constant';
import { TableColumn } from '../../shared/models/table-config.model';

// Child components
import { ParticipantViewDialog } from './components/participant-view-dialog/participant-view-dialog';
import { ParticipantExportDialog } from './components/participant-export-dialog/participant-export-dialog';
import { ParticipantImportDialog } from './components/participant-import-dialog/participant-import-dialog';
import { ImportProgressService } from '../../core/services/import-progress.service';
import { ParticipantListState } from './participant-list-state.service';

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
    ParticipantViewDialog,
    ParticipantExportDialog,
    ParticipantImportDialog,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  providers: [ConfirmationService, ParticipantListState],
})
export class ParticipantList implements OnInit {
  private readonly participantService = inject(ParticipantService);
  private readonly authService = inject(AuthService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listState = inject(ParticipantListState);
  private readonly importProgress = inject(ImportProgressService);
  private readonly eventSelector = viewChild(EventSelector);
  private readonly participantFormComponent = viewChild<ParticipantForm>(
    'participantFormComponent',
  );

  // Cascading filter signals (URL-synced)
  selectedOrganizationId = signal<number | undefined>(undefined);
  selectedEventId = signal<number | undefined>(undefined);

  // User role signals
  isOrganizerUser = signal(false);

  // Import dialog state
  showImportDialog = signal(false);
  isUploading = signal(false);

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

  // Column configuration (shared with table tab via export dialog)
  allColumns = PARTICIPANT_COLUMNS;

  // Computed: Show tab section only when organization and event are selected
  canShowTabs = computed(
    () => this.selectedOrganizationId() !== undefined && this.selectedEventId() !== undefined,
  );

  // Active tab derived from router state — reads the deepest child route path
  activeTab = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.getDeepestChildPath() ?? 'list'),
    ),
    { initialValue: this.getInitialDeepestChildPath() ?? 'list' },
  );

  private getDeepestChildPath(): string | undefined {
    let snapshot = this.route.snapshot.firstChild;
    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
    }
    return snapshot?.routeConfig?.path;
  }

  private getInitialDeepestChildPath(): string | undefined {
    return this.route.snapshot.firstChild?.firstChild?.routeConfig?.path;
  }

  // Tracks the current route type so the template can decide where (or whether) to render <router-outlet>.
  // - 'tab' → inside the tabs card (list / errors)
  // - 'form' → at root on mobile, dialog on desktop (new / :eventId/:bib/edit)
  // - 'none' → no child route active (bare /participants)
  routeKind = signal<'tab' | 'form' | 'none'>('none');

  // Viewport tracking: on mobile the form renders full-page via <router-outlet />;
  // on desktop the same URL opens the form in the existing p-dialog.
  private mediaQuery = window.matchMedia('(max-width: 768px)');
  isMobile = signal(this.mediaQuery.matches);

  // Convenience computeds for template clarity.
  hasFormRoute = computed(() => this.routeKind() === 'form');
  hasTabRoute = computed(() => this.routeKind() === 'tab');

  // Tracks which dialog is currently driven by the URL: null = closed, 'new' = create,
  // 'edit:<eventId>:<bib>' = edit. Used to ignore router events that don't change dialog state.
  private dialogKey: string | null = null;
  // True when the dialog is being closed by syncDialogToRoute (URL change),
  // so onFormDialogVisibleChange skips its own URL-clearing navigation.
  private closingDialogFromRoute = false;

  ngOnInit(): void {
    // Import completion notifies tabs (table + errors) to refresh in place.
    this.importProgress.completed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evt) => {
      if (evt.eventId !== this.selectedEventId()) return;
      if (evt.status === 'COMPLETED') {
        this.listState.triggerReload();
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

    // React to URL changes (route segments) to open/close the form dialog
    // and to keep selectedEventId in sync with the :eventId path param.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.syncDialogToRoute();
        this.applyUrlToState(this.route.snapshot.queryParamMap);
      });

    // URL is the source of truth for org filter and (fallback) event filter.
    // queryParamMap emits synchronously on subscribe, which seeds the initial state.
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
    const eventIdQueryParam = params.get('eventId');
    // Path eventId comes from either `event/:eventId/...` or `:eventId/:bib/edit`.
    const eventIdPathParam = this.route.snapshot.firstChild?.paramMap.get('eventId');

    const orgId =
      orgIdParam && Number.isFinite(Number(orgIdParam)) ? Number(orgIdParam) : undefined;
    // Path eventId wins — it's what the router-outlet's tab (or edit form) is rendering.
    const eventIdSource = eventIdPathParam ?? eventIdQueryParam;
    const eventId =
      eventIdSource && Number.isFinite(Number(eventIdSource)) ? Number(eventIdSource) : undefined;

    const prevOrgId = this.selectedOrganizationId();

    this.selectedOrganizationId.set(orgId);
    this.selectedEventId.set(eventId);

    if (orgId !== prevOrgId) {
      // Reset event selector UI when organization changes.
      this.eventSelector()?.reset();
    }
  }

  onOrganizationChange(organizationId: number | undefined): void {
    // Navigate back to /participants (off any event sub-route) and reset event selection.
    this.router.navigate(['/participants'], {
      queryParams: {
        organizationId: organizationId != null ? String(organizationId) : null,
        eventId: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onEventChange(eventId: number | undefined): void {
    if (eventId != null) {
      // Navigate to the list tab for the new event, preserving queryParams (and updating eventId).
      this.router.navigate(['/participants/event', eventId, 'list'], {
        queryParams: { eventId: String(eventId) },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } else {
      // Cleared event: go back to /participants with no eventId.
      this.router.navigate(['/participants'], {
        queryParams: { eventId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  // ---------- View dialog ----------
  openViewDialog(participant: Participant): void {
    this.viewParticipant.set(participant);
    this.showViewDialog.set(true);
  }

  // ---------- Create / Edit dialog (URL-driven) ----------
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

  onFormSubmitDisabledChange(disabled: boolean): void {
    this.formSubmitDisabled.set(disabled);
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
    // User-initiated close (X / overlay click) — clear the route segment back to current tab.
    this.dialogKey = null;
    this.navigateBackToTab();
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
    // List data is already updated via ParticipantListBus; just clear the form route.
    this.navigateBackToTab();
  }

  private navigateBackToTab(): void {
    const eventId = this.selectedEventId();
    if (eventId) {
      this.router.navigate(['/participants/event', eventId, 'list'], {
        queryParamsHandling: 'preserve',
      });
    } else {
      this.router.navigate(['/participants'], { queryParamsHandling: 'preserve' });
    }
  }

  private syncDialogToRoute(): void {
    const child = this.route.snapshot.firstChild;
    const segments = child?.url ?? [];
    let nextKey: string | null = null;
    let kind: 'tab' | 'form' | 'none' = 'none';

    if (segments.length === 1 && segments[0].path === 'new') {
      nextKey = 'new';
      kind = 'form';
    } else if (segments.length === 3 && segments[2].path === 'edit') {
      // :eventId/:bib/edit
      nextKey = `edit:${segments[0].path}:${segments[1].path}`;
      kind = 'form';
    } else if (segments.length >= 1 && segments[0].path === 'event') {
      kind = 'tab';
    }

    this.routeKind.set(kind);

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

  // ---------- Export ----------
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

  // ---------- Import ----------
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
}
