import { Component, computed, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, ParamMap, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { Popover, PopoverModule } from 'primeng/popover';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

import { User, UserRole } from '../../../core/models/user.model';
import { PageableParams, PageableResponse } from '../../../core/models/api.model';
import { UserService } from '../../../core/services/user.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { Organization } from '../../../core/models/organization.model';
import { USER_COLUMNS } from '../../../shared/constants/user-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { USER_SORT_OPTIONS } from '../../../shared/constants/sort-options.constant';
import { UserForm } from '../user-form/user-form';
import { InviteForm } from '../invite-form/invite-form';
import { UserListBus, UserMutation } from '../user-list-bus.service';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { EventNamePipe } from '../../../shared/pipes/event-name-pipe';
import { EventLogoPipe } from '../../../shared/pipes/event-logo-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';
import { UserSummaryPipe } from '../../../shared/pipes/user-summary-pipe';
import { BaseTableComponent } from '../../../shared/base/base-table.component';
import { TableColumn, TableFilterPreferences } from '../../../shared/models/table-config.model';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { RoleOption } from '../../../core/models/user.model';
import {
  FULL_ROLE_FILTER_OPTIONS,
  ORG_ROLE_FILTER_OPTIONS,
} from '../../../shared/constants/role-filter-options.constant';
import { userCanManage } from '../../../shared/utils/user-permissions.utils';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { ListShell } from '../../../shared/components/list/list-shell/list-shell';
import { EmptyIllustration } from '../../../shared/illustrations/empty-illustration';

interface UserFilterPreferences extends TableFilterPreferences {
  enabled: boolean;
  role: UserRole | null;
  organizationId: number | null;
  sort: string[];
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    PopoverModule,
    DividerModule,
    ConfirmPopupModule,
    SkeletonModule,
    CardModule,
    CheckboxModule,
    SelectModule,
    TagModule,
    FloatLabelModule,
    MenuModule,
    AvatarModule,
    DefaultValuePipe,
    EventNamePipe,
    EventLogoPipe,
    InitialsPipe,
    UserSummaryPipe,
    OrganizationSelector,
    ListShell,
    EmptyIllustration,
    RouterLink,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList extends BaseTableComponent<User, UserFilterPreferences> {
  @ViewChild('orgPopover') orgPopover!: Popover;
  // Organization popover state
  organizationCache = new Map<number, Organization>();
  loadingOrganizationId = signal<number | null>(null);
  currentOrganizationDetails = signal<Organization | null>(null);
  // Toggle enabled state
  togglingUserId = signal<number | null>(null);
  // Delete state
  deletingUserId = signal<number | null>(null);
  // User-specific filters
  filterRole = signal<UserRole | null>(null);
  filterOrganizationId = signal<number | null>(null);
  // Deep-link only filter (no UI control): /users?eventId=10 lists that event's distributors.
  filterEventId = signal<number | null>(null);
  // User-specific sort options
  readonly sortOptions = USER_SORT_OPTIONS;
  // Base class requirements
  protected override columnPreferenceKey = STORAGE_KEYS.USER_TABLE_COLUMNS;
  protected override filterPreferenceKey = STORAGE_KEYS.USER_TABLE_FILTERS;
  protected override allColumns: TableColumn[] = USER_COLUMNS;
  private userService = inject(UserService);
  private organizationService = inject(OrganizationService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private userListBus = inject(UserListBus);
  // Drawer badge: count of filters set away from their defaults.
  activeFilterCount = computed(() => {
    let count = 0;
    if (!this.filterEnabled()) count++;
    if (this.filterRole() !== null) count++;
    if (this.filterOrganizationId() !== null) count++;
    if (this.selectedSort() !== null) count++;
    return count;
  });
  // Debounces raw search input keystrokes before pushing the next URL.
  private urlSearchSubject = new Subject<string>();
  // Single-flight load trigger; switchMap below cancels the prior HTTP request when a new emit arrives.
  private loadTrigger = new Subject<void>();
  // Default page size — kept consistent with BaseTableComponent's initial pageSize signal so
  // the URL stays clean (?size=… is only emitted when the user picks a non-default size).
  private readonly DEFAULT_PAGE_SIZE = 20;

  constructor() {
    super();
    this.initializeColumns();

    // Subscribe to the load pipeline BEFORE queryParamMap — the route observable emits the
    // current value synchronously on subscribe, which triggers loadTrigger.next() inside
    // applyUrlToState. If the switchMap subscription isn't active yet, that first emission is
    // dropped (Subject doesn't replay) and the initial fetch never fires.
    this.loadTrigger
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          const params = this.buildUserSearchParams();
          return this.userService.searchUsers(params).pipe(
            catchError((error) => {
              this.handleLoadError(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: PageableResponse<User>) => this.handleLoadSuccess(response));

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

    this.userListBus.mutations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mutation) => this.applyUserMutation(mutation));
  }

  private applyUserMutation(mutation: UserMutation): void {
    const current = this.entities();
    if (mutation.action === 'created') {
      this.entities.set([mutation.user, ...current]);
      this.totalRecords.set(this.totalRecords() + 1);
    } else {
      const updated = current.map((u) => (u.id === mutation.user.id ? mutation.user : u));
      this.entities.set(updated);
    }
  }

  getRoleSeverity(role: UserRole): 'danger' | 'success' | 'info' | 'warn' | 'secondary' {
    switch (role) {
      case UserRole.ROOT:
        return 'danger';
      case UserRole.ADMIN:
        return 'info';
      case UserRole.ORGANIZER_ADMIN:
        return 'success';
      case UserRole.ORGANIZER_USER:
        return 'warn';
      case UserRole.DISTRIBUTOR:
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  getColumnAlignment(field: string): string {
    // Center alignment for status/tag columns
    if (['enabled', 'role', 'accountNonLocked'].includes(field)) {
      return 'text-center';
    }
    // Right alignment for numeric columns
    if (['id'].includes(field)) {
      return 'text-right';
    }
    // Left alignment for all other columns (default)
    return '';
  }

  openOrganizationPopover(event: Event, organizationId: number): void {
    // Check if already cached
    if (this.organizationCache.has(organizationId)) {
      this.currentOrganizationDetails.set(this.organizationCache.get(organizationId)!);
      this.orgPopover.show(event);

      if (this.orgPopover.container) {
        this.orgPopover.align();
      }
      return;
    }

    // Set loading state and open popover
    this.loadingOrganizationId.set(organizationId);
    this.currentOrganizationDetails.set(null);
    this.orgPopover.show(event);

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

  toggleUserEnabled(event: Event, user: User): void {
    const action = user.enabled ? 'disable' : 'enable';

    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: `Do you want to ${action} ${user.username}?`,
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
        this.togglingUserId.set(user.id);

        this.userService.toggleEnabled(user.id).subscribe({
          next: (updatedUser) => {
            // Update the user in the list
            const currentUsers = this.entities();
            const updatedUsers = currentUsers.map((u) =>
              u.id === updatedUser.id ? updatedUser : u,
            );
            this.entities.set(updatedUsers);

            this.togglingUserId.set(null);

            // Show success message
            this.toast.success(
              `User ${updatedUser.enabled ? 'enabled' : 'disabled'} successfully`,
              'Updated',
            );
          },
          error: (error) => {
            this.togglingUserId.set(null);
            this.errorHandler.showError(error, 'Failed to toggle user status');
          },
        });
      },
    });
  }

  // The "Create" button opens this popup menu: fill in details now, or issue an
  // invite link the new user accepts themselves.
  readonly createMenuItems: MenuItem[] = [
    {
      label: 'Create manually',
      icon: 'pi pi-user-plus',
      command: () => this.openCreateDialog(),
    },
    {
      label: 'Invite via link',
      icon: 'pi pi-link',
      command: () => this.openInviteDialog(),
    },
  ];

  onEdit(user: User): void {
    this.router.navigate(['/users', user.id, 'edit'], { queryParamsHandling: 'preserve' });
  }

  // Create always opens as a dialog (desktop and mobile alike — openDialog goes
  // full-width on small screens). On success UserForm publishes to UserListBus,
  // which prepends the new row in place; the list is never refetched. An optional
  // `role` preselects the dropdown (used by the dashboard quick-create shortcuts).
  private openCreateDialog(role?: UserRole): void {
    this.openDialog(UserForm, 'Create User', { role });
  }

  // Issue a one-time invite link instead of creating the account directly. The
  // dialog collects the fixed role/org and returns a shareable link; no row is
  // added until the invitee accepts (and they land here on the next refresh).
  private openInviteDialog(): void {
    this.openDialog(InviteForm, 'Invite User', {});
  }

  canManageUser(user: User): boolean {
    return userCanManage(this.authService.currentUser(), user);
  }

  onDelete(event: Event, user: User): void {
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: `Delete user ${user.username}? This cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger',
      },
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      accept: () => {
        this.deletingUserId.set(user.id);

        this.userService.deleteUser(user.id).subscribe({
          next: () => {
            const remaining = this.entities().filter((u) => u.id !== user.id);
            this.entities.set(remaining);
            this.totalRecords.set(Math.max(0, this.totalRecords() - 1));
            this.deletingUserId.set(null);

            this.toast.success(`User ${user.username} deleted successfully`, 'Deleted');
          },
          error: (error) => {
            this.deletingUserId.set(null);
            this.errorHandler.showError(error);
          },
        });
      },
    });
  }

  canFilterByOrganization(): boolean {
    return this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);
  }

  get roleOptions(): RoleOption[] {
    return this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN])
      ? FULL_ROLE_FILTER_OPTIONS
      : ORG_ROLE_FILTER_OPTIONS;
  }

  onRoleFilterChange(value: UserRole | null): void {
    this.filterRole.set(value);
    this.onFilterChange();
  }

  onOrganizationFilterChange(value: number | undefined): void {
    this.filterOrganizationId.set(value ?? null);
    this.onFilterChange();
  }

  override onSearchInput(value: string): void {
    this.urlSearchSubject.next(value);
  }

  override clearSearch(): void {
    this.pushStateToUrl({ q: null, page: null });
  }

  override onFilterChange(): void {
    this.pushStateToUrl({
      enabled: this.filterEnabled() ? null : 'false',
      role: this.filterRole(),
      org: this.canFilterByOrganization() ? this.filterOrganizationId() : null,
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

  private buildUserSearchParams(): PageableParams {
    const params = this.buildPageableParams();
    const role = this.filterRole();
    if (role) {
      params.role = role;
    }
    if (this.canFilterByOrganization()) {
      const orgId = this.filterOrganizationId();
      if (orgId !== null) {
        params.organizationId = orgId;
      }
    }
    const eventId = this.filterEventId();
    if (eventId !== null) {
      params.eventId = eventId;
    }
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
    const roleParam = params.get('role') as UserRole | null;
    const orgParam = params.get('org');
    const sortParam = params.get('sort');

    this.searchTerm.set(q);
    // URL page is 1-indexed (?page=2 = second page); convert to 0-indexed for backend/state.
    this.currentPage.set(Number.isFinite(pageParam) && pageParam > 1 ? pageParam - 1 : 0);
    this.pageSize.set(
      Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : this.DEFAULT_PAGE_SIZE,
    );
    this.filterEnabled.set(enabledParam !== 'false');

    const allowedRoles = new Set(this.roleOptions.map((o) => o.value));
    this.filterRole.set(roleParam && allowedRoles.has(roleParam) ? roleParam : null);

    const orgId = orgParam ? Number(orgParam) : NaN;
    this.filterOrganizationId.set(Number.isFinite(orgId) ? orgId : null);

    const eventParam = params.get('eventId');
    const eventId = eventParam ? Number(eventParam) : NaN;
    this.filterEventId.set(Number.isFinite(eventId) ? eventId : null);

    this.selectedSort.set(sortParam);
    this.filterSort.set(sortParam ? [sortParam] : []);

    this.loadData();

    // Dashboards deep-link here with ?create=true (optionally &createRole=…) to start
    // a new user. createRole is distinct from the `role` filter param above so the
    // two don't collide. Strip the flags from the URL and open the create dialog.
    if (params.get('create') === 'true') {
      const createRole = params.get('createRole') as UserRole | null;
      this.pushStateToUrl({ create: null, createRole: null });
      this.openCreateDialog(createRole ?? undefined);
    }
  }

  protected override getDefaultFilterPreferences(): UserFilterPreferences {
    return {
      enabled: true,
      role: null,
      organizationId: null,
      sort: [],
    };
  }

  protected override getCurrentFilterPreferences(): UserFilterPreferences {
    return {
      enabled: this.filterEnabled(),
      role: this.filterRole(),
      organizationId: this.filterOrganizationId(),
      sort: this.filterSort(),
    };
  }

  protected override applyFilterPreferences(prefs: UserFilterPreferences): void {
    this.filterEnabled.set(prefs.enabled);

    // Drop saved role if it's no longer in the user's allowed role-filter set
    // (e.g., prefs saved while logged in as ROOT, now logged in as ORGANIZER_USER).
    const allowedRoles = new Set(this.roleOptions.map((o) => o.value));
    this.filterRole.set(prefs.role && allowedRoles.has(prefs.role) ? prefs.role : null);

    this.filterOrganizationId.set(prefs.organizationId ?? null);
    this.filterSort.set(prefs.sort);
  }
}
