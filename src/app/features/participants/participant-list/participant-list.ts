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
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ImportMode, Participant } from '../../../core/models/participant.model';
import { ParticipantService } from '../../../core/services/participant.service';
import { AuthService } from '../../../core/services/auth.service';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { UserRole } from '../../../core/models/user.model';
import { EventStatus } from '../../../core/models/event.model';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { EventSelector } from '../../../layout/event-selector/event-selector';
import { ParticipantForm } from '../participant-form/participant-form';
import { ParticipantDetails } from '../participant-details/participant-details';
import { PARTICIPANT_COLUMNS } from '../../../shared/constants/participant-columns.constant';
import { BUTTON_SIZE } from '../../../shared/constants/form.constants';
import { TableColumn } from '../../../shared/models/table-config.model';
import { MobileTabBar, TabItem } from '../../../shared/components/mobile-tab-bar/mobile-tab-bar';
import { EmptyIllustration } from '../../../shared/illustrations/empty-illustration';

// Child components
import { ParticipantExportDialog } from './participant-export-dialog/participant-export-dialog';
import { ParticipantTableTab } from './participant-table-tab/participant-table-tab';
import { ImportProgressService } from '../../../core/services/import-progress.service';
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
    TooltipModule,
    ConfirmDialogModule,
    OrganizationSelector,
    EventSelector,
    ParticipantForm,
    ParticipantDetails,
    ParticipantExportDialog,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MobileTabBar,
    EmptyIllustration,
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

  // Create form dialog state (edit goes through the Details dialog now)
  showFormDialog = signal(false);
  formDialogData = signal<{ eventId: number } | null>(null);
  // Mirrors the form's isSubmitDisabled() so the dialog footer button can disable until validation passes.
  formSubmitDisabled = signal<boolean>(true);

  // Details dialog state — view + per-field inline edit
  showDetailsDialog = signal(false);
  detailsContext = signal<{ eventId: number; bibNumber: string } | null>(null);

  // Export dialog state
  showExportDialog = signal(false);
  isExporting = signal(false);

  // Column configuration (shared with table tab via export dialog)
  allColumns = PARTICIPANT_COLUMNS;

  // Button sizing for the page-level action toolbar
  protected readonly buttonSize = BUTTON_SIZE;

  // Mobile bottom tab bar — ids match the child route paths (list / errors) and
  // mirror the desktop tab strip. Labels show in the expanded grid sheet.
  protected readonly participantTabs: TabItem[] = [
    { id: 'list', label: 'Imported Participants', icon: 'pi-users' },
    { id: 'errors', label: 'Import Errors', icon: 'pi-exclamation-triangle' },
  ];

  // Computed: Show tab section only when organization and event are selected
  canShowTabs = computed(
    () => this.selectedOrganizationId() !== undefined && this.selectedEventId() !== undefined,
  );

  // The currently selected event (with status), read from the event selector.
  protected readonly selectedEvent = computed(() => this.eventSelector()?.selectedEvent() ?? null);

  // Full Import wipes existing participants, so the backend allows it for DRAFT
  // events only. Add-on (append walk-ins) is also allowed for PUBLISHED events.
  protected readonly canFullImport = computed(
    () => this.selectedEventId() != null && this.selectedEvent()?.status === EventStatus.DRAFT,
  );
  protected readonly canAddOn = computed(() => {
    const status = this.selectedEvent()?.status;
    return (
      this.selectedEventId() != null &&
      (status === EventStatus.DRAFT || status === EventStatus.PUBLISHED)
    );
  });

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

  // Viewport tracking — drives dialog sizing (full-screen on mobile, modal on desktop).
  // Backed by the shared BreakpointService (one app-wide signal/listener).
  isMobile = inject(BreakpointService).isMobile;

  // Dialogs are signal-driven overlays (not routes): opening/closing one never
  // unmounts the participant table behind it, so closing is instant — no re-render,
  // no refetch. Full-screen on mobile, centered modal on desktop.
  protected readonly detailsDialogStyle = computed(() =>
    this.isMobile()
      ? { width: '100vw', height: '100vh', maxHeight: '100vh' }
      : { width: '95vw', maxWidth: '1100px', height: '90vh' },
  );
  protected readonly formDialogStyle = computed(() =>
    this.isMobile()
      ? { width: '100vw', height: '100vh', maxHeight: '100vh' }
      : { width: '95vw', maxWidth: '700px', maxHeight: '90vh' },
  );

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

    // Keep selectedOrganizationId / selectedEventId in sync with the URL (org/event
    // filters live in query params; the active event also comes from the :eventId path).
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.applyUrlToState(this.route.snapshot.queryParamMap));

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

    if (prevOrgId !== undefined && orgId !== prevOrgId) {
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

  // ---------- Create dialog (signal-driven overlay) ----------
  openCreateDialog(): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    this.formSubmitDisabled.set(true);
    this.formDialogData.set({ eventId });
    this.showFormDialog.set(true);
  }

  // ---------- Details dialog (signal-driven overlay, view + inline edit) ----------
  openDetailsDialog(participant: Participant): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    this.detailsContext.set({ eventId, bibNumber: participant.bibNumber });
    this.showDetailsDialog.set(true);
  }

  /** Absolute URL of the open participant's shareable standalone details page. */
  private detailsShareUrl(): string | null {
    const ctx = this.detailsContext();
    if (!ctx) return null;
    const tree = this.router.createUrlTree(
      ['/participants', ctx.eventId, ctx.bibNumber, 'details'],
      {
        queryParams: {
          organizationId: this.selectedOrganizationId() ?? null,
          eventId: ctx.eventId,
        },
      },
    );
    return new URL(this.router.serializeUrl(tree), window.location.origin).toString();
  }

  /**
   * Share the participant's link (the dialog header "share" icon). On devices that
   * support the Web Share API (mostly mobile) this opens the native share sheet;
   * elsewhere (most desktops) it falls back to copying the link to the clipboard.
   */
  protected async shareDetails(): Promise<void> {
    const url = this.detailsShareUrl();
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Participant details', url });
        return;
      } catch (err) {
        // The user dismissed the share sheet — leave it at that, don't also copy.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Any other failure falls through to the clipboard copy below.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Shareable link copied to clipboard');
    } catch {
      this.toast.error('Could not copy the link');
    }
  }

  /** Open the same participant's standalone page in a new browser tab. */
  protected openDetailsInNewTab(): void {
    const url = this.detailsShareUrl();
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.click();
  }

  onFormSubmitDisabledChange(disabled: boolean): void {
    this.formSubmitDisabled.set(disabled);
  }

  // Mobile tab bar selection — navigate to the sibling tab route, same as the
  // desktop tab strip's routerLinks (preserving query params for org/event filters).
  onTabChange(tabId: string): void {
    const eventId = this.selectedEventId();
    if (!eventId) return;
    this.router.navigate(['/participants/event', eventId, tabId], {
      queryParamsHandling: 'preserve',
    });
  }

  closeFormDialog(): void {
    this.showFormDialog.set(false);
    this.formDialogData.set(null);
  }

  closeDetailsDialog(): void {
    this.showDetailsDialog.set(false);
    this.detailsContext.set(null);
  }

  onFormDialogVisibleChange(visible: boolean): void {
    if (!visible) this.closeFormDialog();
  }

  onDetailsDialogVisibleChange(visible: boolean): void {
    if (!visible) this.closeDetailsDialog();
  }

  submitFormDialog(): void {
    this.participantFormComponent()?.submitForm();
  }

  onFormSubmitSuccess(): void {
    this.toast.success('Participant created successfully', 'Success');
    // The new row is already in the list via ParticipantListBus — just close the dialog.
    this.closeFormDialog();
  }

  private pushStateToUrl(updates: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updates,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ---------- Refresh ----------
  // Explicit, user-triggered reload of the list (not an auto-refresh) — for when the
  // data may have changed elsewhere. The table tab reloads via the reloadTrigger.
  refreshList(): void {
    this.listState.triggerReload();
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
  // Opens the column-mapping importer for the selected event in the requested mode.
  // The mapper owns the upload → map → confirm → launch flow and reports progress
  // via ImportProgressService. IMPORT (full replace) is DRAFT-only; ADD_ON (append
  // walk-ins) is allowed for DRAFT or PUBLISHED — each button gates its own mode.
  startImport(mode: ImportMode = 'IMPORT'): void {
    const eventId = this.selectedEventId();
    if (eventId == null) return;
    if (mode === 'IMPORT' && !this.canFullImport()) return;
    if (mode === 'ADD_ON' && !this.canAddOn()) return;
    this.router.navigate(['/participants/import-map'], {
      queryParams: { eventId: String(eventId), mode },
    });
  }

  // Wire ParticipantTableTab outputs when it activates inside the router-outlet.
  // Subscriptions live with the activated component instance and tear down on deactivate.
  onTabActivated(component: unknown): void {
    if (!(component instanceof ParticipantTableTab)) return;
    component.importRequested.subscribe(() => this.startImport());
    component.createRequested.subscribe(() => this.openCreateDialog());
    component.exportRequested.subscribe(() => this.openExportDialog());
    component.detailsRequested.subscribe((p) => this.openDetailsDialog(p));
  }
}
