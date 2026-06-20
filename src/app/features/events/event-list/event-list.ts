import { Component, computed, DestroyRef, effect, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Params,
  ParamMap,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { TagModule } from 'primeng/tag';
import { Menu } from 'primeng/menu';
import { Popover, PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { FloatLabelModule } from 'primeng/floatlabel';
import { AvatarModule } from 'primeng/avatar';
import { ListShell } from '../../../shared/components/list/list-shell/list-shell';
import { Event, EventStatus } from '../../../core/models/event.model';
import { PageableParams, PageableResponse } from '../../../core/models/api.model';
import { EventService } from '../../../core/services/event.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { Organization } from '../../../core/models/organization.model';
import { UserRole } from '../../../core/models/user.model';
import { EVENT_COLUMNS } from '../../../shared/constants/event-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { EVENT_SORT_OPTIONS } from '../../../shared/constants/sort-options.constant';
import { EventForm } from '../event-form/event-form';
import { EventListBus, EventMutation } from '../event-list-bus.service';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatEventDateTimePipe } from '../../../shared/pipes/format-event-date-time-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';
import { UserSummaryPipe } from '../../../shared/pipes/user-summary-pipe';
import { BaseTableComponent } from '../../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../../shared/models/table-config.model';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import {
  getEventStatusSeverity,
  getEventStatusLabel,
} from '../../../shared/utils/event-status.utils';

interface EventFilterPreferences extends TableFilterPreferences {
  status: string[];
  organizationId?: number;
  sort: string[];
}
@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    TooltipModule,
    SkeletonModule,
    SelectModule,
    ConfirmPopupModule,
    TagModule,
    Menu,
    PopoverModule,
    DividerModule,
    FloatLabelModule,
    AvatarModule,
    DefaultValuePipe,
    FormatEventDateTimePipe,
    InitialsPipe,
    UserSummaryPipe,
    OrganizationSelector,
    RouterOutlet,
    RouterLink,
    ListShell,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './event-list.html',
  styleUrl: './event-list.css',
})
export class EventList extends BaseTableComponent<Event, EventFilterPreferences> {
  @ViewChild('orgPopover') orgPopover!: Popover;
  filterStatus = signal<string[]>([]);
  filterOrganizationId = signal<number | undefined>(undefined);
  togglingEventId = signal<number | null>(null);
  changingStatusEventId = signal<number | null>(null);
  statusMenuItems = signal<MenuItem[]>([]);
  // Organization popover state
  organizationCache = new Map<number, Organization>();
  loadingOrganizationId = signal<number | null>(null);
  currentOrganizationDetails = signal<Organization | null>(null);
  readonly sortOptions = EVENT_SORT_OPTIONS;
  readonly statusOptions = [
    { label: 'Draft', value: EventStatus.DRAFT },
    { label: 'Published', value: EventStatus.PUBLISHED },
    { label: 'Cancelled', value: EventStatus.CANCELLED },
    { label: 'Completed', value: EventStatus.COMPLETED },
  ];
  protected override columnPreferenceKey = STORAGE_KEYS.EVENT_TABLE_COLUMNS;
  protected override filterPreferenceKey = STORAGE_KEYS.EVENT_TABLE_FILTERS;
  protected override allColumns = EVENT_COLUMNS;
  private eventService = inject(EventService);
  readonly isRootOrAdmin = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);
  readonly canChangeStatus = this.authService.hasAnyRole([
    UserRole.ROOT,
    UserRole.ADMIN,
    UserRole.ORGANIZER_ADMIN,
    UserRole.ORGANIZER_USER,
  ]);
  private organizationService = inject(OrganizationService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private eventListBus = inject(EventListBus);
  private lastClickTarget: EventTarget | null = null;
  // Tracks which dialog is currently driven by the URL: null = closed, 'new' = create,
  // 'edit:<id>' = edit. Used to ignore router events that don't change the dialog state.
  private dialogKey: string | null = null;
  // True when the dialog is being closed by syncDialogToRoute (URL change),
  // so the onClose handler skips its own URL-clearing navigation.
  private closingDialogFromRoute = false;
  // isMobile is provided by BaseTableComponent; the form renders full-page via
  // <router-outlet /> on mobile, and as an overlay dialog on desktop.
  hasFormRoute = signal(false);
  // Drawer badge: count of filters set away from their defaults.
  activeFilterCount = computed(() => {
    let count = 0;
    if (!this.filterEnabled()) count++;
    if (this.filterStatus().length > 0) count++;
    if (this.isRootOrAdmin && this.filterOrganizationId() != null) count++;
    if (this.selectedSort() !== null) count++;
    return count;
  });
  // Debounces raw search input keystrokes before pushing the next URL.
  private urlSearchSubject = new Subject<string>();
  // Single-flight load trigger; switchMap below cancels the prior HTTP request when a new emit arrives.
  private loadTrigger = new Subject<void>();
  // Default page size — applied on init (overriding BaseTableComponent's signal) so
  // the URL stays clean (?size=… is only emitted when the user picks a non-default size).
  private readonly DEFAULT_PAGE_SIZE = 20;

  constructor() {
    super();
    this.initializeColumns();
    this.filterColumnsBasedOnRole();
    this.syncDialogToRoute();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncDialogToRoute());

    // Re-sync dialog when the viewport flips between mobile and desktop.
    effect(() => {
      this.isMobile();
      this.syncDialogToRoute();
    });

    // Subscribe to the load pipeline BEFORE queryParamMap — the route observable emits the
    // current value synchronously on subscribe, which triggers loadTrigger.next() inside
    // applyUrlToState. If the switchMap subscription isn't active yet, that first emission is
    // dropped (Subject doesn't replay) and the initial fetch never fires.
    this.loadTrigger
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          const params = this.buildEventSearchParams();
          return this.eventService.searchEvents(params).pipe(
            catchError((error) => {
              this.handleLoadError(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: PageableResponse<Event>) => this.handleLoadSuccess(response));

    this.urlSearchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const trimmed = value.trim();
        // Backend treats <2 chars as no filter; mirror that in the URL so links stay clean.
        this.pushStateToUrl({ q: trimmed.length >= 2 ? trimmed : null, page: null });
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyUrlToState(params));

    this.eventListBus.mutations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mutation) => this.applyEventMutation(mutation));
  }

  private applyEventMutation(mutation: EventMutation): void {
    const current = this.entities();
    if (mutation.action === 'created') {
      this.entities.set([mutation.event, ...current]);
      this.totalRecords.set(this.totalRecords() + 1);
    } else {
      const updated = current.map((e) => (e.id === mutation.event.id ? mutation.event : e));
      this.entities.set(updated);
    }
  }

  /**
   * Handle organization filter change
   */
  handleOrgFilterChange(orgId: number | undefined): void {
    this.filterOrganizationId.set(orgId);
    this.onFilterChange();
  }

  openOrganizationPopover(clickEvent: MouseEvent, organizationId: number): void {
    // Check if already cached
    if (this.organizationCache.has(organizationId)) {
      this.currentOrganizationDetails.set(this.organizationCache.get(organizationId)!);
      this.orgPopover.show(clickEvent);

      if (this.orgPopover.container) {
        this.orgPopover.align();
      }
      return;
    }

    // Set loading state and open popover
    this.loadingOrganizationId.set(organizationId);
    this.currentOrganizationDetails.set(null);
    this.orgPopover.show(clickEvent);

    if (this.orgPopover.container) {
      this.orgPopover.align();
    }

    // Fetch from API
    this.organizationService.getOrganizationById(organizationId).subscribe({
      next: (organization) => {
        this.organizationCache.set(organizationId, organization);
        this.currentOrganizationDetails.set(organization);
        this.loadingOrganizationId.set(null);

        // Realign after content loads
        if (this.orgPopover.container) {
          this.orgPopover.align();
        }
      },
      error: (error) => {
        this.loadingOrganizationId.set(null);
        this.orgPopover.hide();
        this.errorHandler.showError(error, 'Failed to load organization');
      },
    });
  }

  getEventStatusSeverity = getEventStatusSeverity;

  formatDateRange(startDate: Date | undefined, endDate: Date | undefined): string {
    if (!startDate || !endDate) {
      return '--';
    }
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  }

  getColumnAlignment(field: string): string {
    // Center alignment for status/tag columns
    if (['status', 'enabled'].includes(field)) {
      return 'text-center';
    }
    // Right alignment for numeric columns
    if (['id', 'organizationId', 'latitude', 'longitude'].includes(field)) {
      return 'text-right';
    }
    // Left alignment for all other columns (default)
    return '';
  }

  onCreate(): void {
    this.router.navigate(['/events/new'], { queryParamsHandling: 'preserve' });
  }

  onEdit(event: Event): void {
    this.router.navigate(['/events', event.id, 'edit'], { queryParamsHandling: 'preserve' });
  }

  onView(event: Event): void {
    this.router.navigate(['/events', event.id]);
  }

  onDelete(event: Event, confirmEvent: MouseEvent): void {
    this.confirmationService.confirm({
      target: confirmEvent.target as EventTarget,
      message: `Are you sure you want to delete "${event.eventName}"?`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eventService.deleteEvent(event.id).subscribe({
          next: () => {
            this.toast.success('Event deleted successfully', 'Deleted');
            this.loadData();
          },
          error: (error) => {
            this.errorHandler.showError(error);
          },
        });
      },
    });
  }

  toggleEventEnabled(clickEvent: MouseEvent, event: Event): void {
    const action = event.enabled ? 'disable' : 'enable';

    this.confirmationService.confirm({
      target: clickEvent.currentTarget as EventTarget,
      message: `Do you want to ${action} "${event.eventName}"?`,
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
        this.togglingEventId.set(event.id);

        this.eventService.toggleEnabled(event.id).subscribe({
          next: (updatedEvent) => {
            const currentEvents = this.entities();
            const updatedEvents = currentEvents.map((e) =>
              e.id === updatedEvent.id ? updatedEvent : e,
            );
            this.entities.set(updatedEvents);
            this.togglingEventId.set(null);
            this.toast.success(
              `Event ${updatedEvent.enabled ? 'enabled' : 'disabled'} successfully`,
              'Updated',
            );
          },
          error: (error) => {
            this.togglingEventId.set(null);
            this.handleLoadError(error);
          },
        });
      },
    });
  }

  changeEventStatus(event: Event, newStatus: EventStatus): void {
    if (event.status === newStatus) {
      return;
    }

    const statusLabel = this.getStatusLabel(newStatus);

    this.confirmationService.confirm({
      target: this.lastClickTarget as EventTarget,
      message: `Do you want to change "${event.eventName}" status to ${statusLabel}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: statusLabel,
        severity: this.getEventStatusSeverity(newStatus),
      },
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      accept: () => {
        this.changingStatusEventId.set(event.id);

        this.eventService.changeEventStatus(event.id, newStatus).subscribe({
          next: (updatedEvent) => {
            const currentEvents = this.entities();
            const updatedEvents = currentEvents.map((e) =>
              e.id === updatedEvent.id ? updatedEvent : e,
            );
            this.entities.set(updatedEvents);
            this.changingStatusEventId.set(null);
            this.toast.success(`Event status changed to ${statusLabel} successfully`, 'Updated');
          },
          error: (error) => {
            this.changingStatusEventId.set(null);
            this.handleLoadError(error);
          },
        });
      },
    });
  }

  showStatusMenu(menu: Menu, clickEvent: MouseEvent, event: Event): void {
    if (!this.canChangeStatus) {
      return;
    }

    this.lastClickTarget = clickEvent.currentTarget;

    this.statusMenuItems.set([
      {
        label: 'Draft',
        icon: 'pi pi-file-edit',
        disabled: event.status === EventStatus.DRAFT,
        command: () => this.changeEventStatus(event, EventStatus.DRAFT),
      },
      {
        label: 'Published',
        icon: 'pi pi-check-circle',
        disabled: event.status === EventStatus.PUBLISHED,
        command: () => this.changeEventStatus(event, EventStatus.PUBLISHED),
      },
      {
        label: 'Cancelled',
        icon: 'pi pi-times-circle',
        disabled: event.status === EventStatus.CANCELLED,
        command: () => this.changeEventStatus(event, EventStatus.CANCELLED),
      },
      {
        label: 'Completed',
        icon: 'pi pi-flag',
        disabled: event.status === EventStatus.COMPLETED,
        command: () => this.changeEventStatus(event, EventStatus.COMPLETED),
      },
    ]);

    menu.toggle(clickEvent);
  }

  override onSearchInput(value: string): void {
    this.urlSearchSubject.next(value);
  }

  override clearSearch(): void {
    this.pushStateToUrl({ q: null, page: null });
  }

  override onFilterChange(): void {
    const status = this.filterStatus().length > 0 ? this.filterStatus()[0] : null;
    const organizationId = this.isRootOrAdmin ? this.filterOrganizationId() : undefined;
    this.pushStateToUrl({
      enabled: this.filterEnabled() ? null : 'false',
      status,
      organizationId: organizationId != null ? String(organizationId) : null,
      page: null,
    });
  }

  override onSortChange(value: string | null): void {
    this.selectedSort.set(value);
    this.filterSort.set(value ? [value] : []);
    this.pushStateToUrl({ sort: value, page: null });
  }

  override onPageChange(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.pageSize();
    const page = Math.floor((event.first ?? 0) / size);
    // URL pages are 1-indexed to match what the paginator UI shows; the backend stays 0-indexed.
    this.pushStateToUrl({
      page: page > 0 ? page + 1 : null,
      size: size !== this.DEFAULT_PAGE_SIZE ? size : null,
    });
  }

  protected override loadData(): void {
    this.loadTrigger.next();
  }

  protected override getDefaultFilterPreferences(): EventFilterPreferences {
    return {
      status: [],
      organizationId: undefined,
      sort: [],
    };
  }

  protected override getCurrentFilterPreferences(): EventFilterPreferences {
    return {
      status: this.filterStatus(),
      organizationId: this.filterOrganizationId(),
      sort: this.filterSort(),
    };
  }

  protected override applyFilterPreferences(prefs: EventFilterPreferences): void {
    this.filterStatus.set(prefs.status || []);
    this.filterOrganizationId.set(prefs.organizationId);
    this.filterSort.set(prefs.sort || []);
  }

  private syncDialogToRoute(): void {
    const child = this.route.snapshot.firstChild;
    const segments = child?.url ?? [];
    let nextKey: string | null = null;

    if (segments[0]?.path === 'new') {
      nextKey = 'new';
    } else if (segments.length === 2 && segments[1].path === 'edit') {
      nextKey = `edit:${segments[0].path}`;
    }

    this.hasFormRoute.set(nextKey !== null);

    // On mobile the routed EventForm component takes the whole view; skip the
    // dialog flow and tear down any dialog that was open before a viewport change.
    if (this.isMobile()) {
      if (this.dialogKey !== null && this.dialogRef) {
        this.closingDialogFromRoute = true;
        this.dialogRef.close();
      }
      this.dialogKey = null;
      return;
    }

    if (nextKey === this.dialogKey) {
      return;
    }

    const previousKey = this.dialogKey;
    this.dialogKey = nextKey;

    if (previousKey !== null && this.dialogRef) {
      this.closingDialogFromRoute = true;
      this.dialogRef.close();
    }

    if (nextKey === 'new') {
      this.openCreateDialog();
    } else if (nextKey?.startsWith('edit:')) {
      const id = Number(nextKey.slice('edit:'.length));
      if (Number.isFinite(id)) {
        this.openEditDialog(id);
      }
    }
  }

  private openCreateDialog(): void {
    const currentUser = this.authService.currentUser();
    this.openDialog(
      EventForm,
      'Create Event',
      {
        isEditMode: false,
        organizationId: this.isRootOrAdmin ? undefined : currentUser?.organizationId,
        successMessage: {
          severity: 'success',
          summary: 'Created',
          detail: 'Event created successfully',
        },
      },
      { showHeader: false },
    );

    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe(
        (
          result:
            | {
                event?: Event;
                message?: { severity: string; summary: string; detail: string };
              }
            | undefined,
        ) => {
          if (result?.message) {
            this.toast.show(result.message);
          }
          this.returnToList();
        },
      );
    }
  }

  private openEditDialog(eventId: number): void {
    this.openDialog(
      EventForm,
      'Edit Event',
      {
        eventId,
        isEditMode: true,
        successMessage: {
          severity: 'success',
          summary: 'Updated',
          detail: 'Event updated successfully',
        },
      },
      { showHeader: false },
    );

    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe(
        (
          result:
            | {
                event?: Event;
                message?: { severity: string; summary: string; detail: string };
              }
            | undefined,
        ) => {
          if (result?.message) {
            this.toast.show(result.message);
          }
          this.returnToList();
        },
      );
    }
  }

  // Clear the dialog segment from the URL once the dialog finishes.
  // Skipped when syncDialogToRoute initiated the close — the URL is already moving elsewhere.
  private returnToList(): void {
    if (this.closingDialogFromRoute) {
      this.closingDialogFromRoute = false;
      return;
    }
    this.dialogKey = null;
    this.router.navigate(['/events'], { queryParamsHandling: 'preserve' });
  }

  private buildEventSearchParams(): PageableParams {
    const params: PageableParams = {
      ...this.buildPageableParams(),
      status: this.filterStatus().length > 0 ? this.filterStatus()[0] : undefined,
      organizationId: this.isRootOrAdmin ? this.filterOrganizationId() : undefined,
    };
    return params;
  }

  private pushStateToUrl(updates: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updates,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private applyUrlToState(params: ParamMap): void {
    const q = params.get('q') ?? '';
    const pageParam = Number(params.get('page'));
    const sizeParam = Number(params.get('size'));
    const enabledParam = params.get('enabled');
    const statusParam = params.get('status');
    const organizationIdParam = params.get('organizationId');
    const sortParam = params.get('sort');

    this.searchTerm.set(q);
    // URL page is 1-indexed (?page=2 = second page); convert to 0-indexed for backend/state.
    this.currentPage.set(Number.isFinite(pageParam) && pageParam > 1 ? pageParam - 1 : 0);
    this.pageSize.set(
      Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : this.DEFAULT_PAGE_SIZE,
    );
    this.filterEnabled.set(enabledParam !== 'false');
    this.filterStatus.set(statusParam ? [statusParam] : []);

    const orgId = Number(organizationIdParam);
    this.filterOrganizationId.set(
      organizationIdParam && Number.isFinite(orgId) ? orgId : undefined,
    );

    this.selectedSort.set(sortParam);
    this.filterSort.set(sortParam ? [sortParam] : []);

    this.loadData();
  }

  private filterColumnsBasedOnRole(): void {
    if (!this.isRootOrAdmin) {
      const filteredCols = this.cols().filter(
        (col) => col.field !== 'organizationId' && col.field !== 'enabled',
      );
      this.cols.set(filteredCols);

      const filteredSelectedCols = this.selectedCols().filter(
        (col) => col.field !== 'organizationId' && col.field !== 'enabled',
      );
      this.selectedCols.set(filteredSelectedCols);
    }
  }

  private getStatusLabel = getEventStatusLabel;
}
