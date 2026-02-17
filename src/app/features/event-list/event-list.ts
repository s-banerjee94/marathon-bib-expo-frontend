import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { TagModule } from 'primeng/tag';
import { Menu } from 'primeng/menu';
import { Popover, PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { FloatLabelModule } from 'primeng/floatlabel';
import { Event, EventStatus } from '../../core/models/event.model';
import { PageableParams } from '../../core/models/api.model';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { Organization } from '../../core/models/organization.model';
import { UserRole } from '../../core/models/user.model';
import { EVENT_COLUMNS } from '../../shared/constants/event-columns.constant';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { EVENT_SORT_OPTIONS } from '../../shared/constants/sort-options.constant';
import { EventForm } from '../event-form/event-form';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { BaseTableComponent } from '../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../shared/models/table-config.model';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { getEventStatusSeverity, getEventStatusLabel } from '../../shared/utils/event-status.utils';

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
    MultiSelectModule,
    TooltipModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    CheckboxModule,
    SelectModule,
    ConfirmPopupModule,
    TagModule,
    Menu,
    PopoverModule,
    DividerModule,
    FloatLabelModule,
    DefaultValuePipe,
    OrganizationSelector,
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
  private authService = inject(AuthService);
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
  private lastClickTarget: EventTarget | null = null;

  constructor() {
    super();
    this.initializeColumns();
    this.filterColumnsBasedOnRole();
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
    const currentUser = this.authService.currentUser();
    this.openDialog(EventForm, 'Create Event', {
      isEditMode: false,
      organizationId: this.isRootOrAdmin ? undefined : currentUser?.organizationId,
      successMessage: {
        severity: 'success',
        summary: 'Created',
        detail: 'Event created successfully',
      },
    });

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
          if (result?.event) {
            const currentEvents = this.entities();
            this.entities.set([result.event, ...currentEvents]);
            this.totalRecords.set(this.totalRecords() + 1);
            if (result.message) {
              this.messageService.add(result.message);
            }
          }
        },
      );
    }
  }

  onEdit(event: Event): void {
    this.openDialog(EventForm, 'Edit Event', {
      eventId: event.id,
      isEditMode: true,
      successMessage: {
        severity: 'success',
        summary: 'Updated',
        detail: 'Event updated successfully',
      },
    });

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
          if (result?.event) {
            const currentEvents = this.entities();
            const updatedEvents = currentEvents.map((e) =>
              e.id === result.event!.id ? result.event! : e,
            );
            this.entities.set(updatedEvents);
            if (result.message) {
              this.messageService.add(result.message);
            }
          }
        },
      );
    }
  }

  onView(event: Event): void {
    this.router.navigate(['/events', event.id, 'details']);
  }

  onDelete(event: Event, confirmEvent: MouseEvent): void {
    this.confirmationService.confirm({
      target: confirmEvent.target as EventTarget,
      message: `Are you sure you want to delete "${event.eventName}"?`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eventService.deleteEvent(event.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Deleted',
              detail: 'Event deleted successfully',
            });
            this.loadData();
          },
          error: (error) => {
            this.handleLoadError(error);
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
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: `Event ${updatedEvent.enabled ? 'enabled' : 'disabled'} successfully`,
            });
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
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: `Event status changed to ${statusLabel} successfully`,
            });
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

  protected override loadData(): void {
    this.isLoading.set(true);

    const params: PageableParams = {
      ...this.buildPageableParams(),
      status: this.filterStatus().length > 0 ? this.filterStatus()[0] : undefined,
      organizationId: this.isRootOrAdmin ? this.filterOrganizationId() : undefined,
    };

    this.eventService.searchEvents(params).subscribe({
      next: (response) => this.handleLoadSuccess(response),
      error: (error) => this.handleLoadError(error),
    });
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
