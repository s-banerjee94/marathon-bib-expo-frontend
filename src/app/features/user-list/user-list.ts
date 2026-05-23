import { Component, computed, DestroyRef, effect, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Params,
  ParamMap,
  Router,
  RouterOutlet,
} from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
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
import { FloatLabelModule } from 'primeng/floatlabel';

import { User, UserRole } from '../../core/models/user.model';
import { PageableParams, PageableResponse } from '../../core/models/api.model';
import { UserService } from '../../core/services/user.service';
import { OrganizationService } from '../../core/services/organization.service';
import { Organization } from '../../core/models/organization.model';
import { USER_COLUMNS } from '../../shared/constants/user-columns.constant';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { USER_SORT_OPTIONS } from '../../shared/constants/sort-options.constant';
import { UserForm } from '../user-form/user-form';
import { UserListBus, UserMutation } from '../users/user-list-bus.service';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { BaseTableComponent } from '../../shared/base/base-table.component';
import { TableColumn, TableFilterPreferences } from '../../shared/models/table-config.model';
import { OrganizationSelector } from '../../components/organization-selector/organization-selector';
import { RoleOption } from '../../core/models/user.model';
import {
  FULL_ROLE_FILTER_OPTIONS,
  ORG_ROLE_FILTER_OPTIONS,
} from '../../shared/constants/role-filter-options.constant';
import { userCanManage } from '../../shared/utils/user-permissions.utils';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { ListShell } from '../../shared/components/list/list-shell/list-shell';

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
    DefaultValuePipe,
    OrganizationSelector,
    RouterOutlet,
    ListShell,
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
  // Tracks which dialog is currently driven by the URL: null = closed, 'new' = create, 'edit:<id>' = edit.
  // Used to ignore router events that don't change the dialog state.
  private dialogKey: string | null = null;
  // True when the dialog is being closed by syncDialogToRoute (URL change),
  // so the onClose handler skips its own URL-clearing navigation.
  private closingDialogFromRoute = false;
  hasFormRoute = signal(false);
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
  private readonly DEFAULT_PAGE_SIZE = 5;

  constructor() {
    super();
    this.initializeColumns();
    this.syncDialogToRoute();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncDialogToRoute());

    // Viewport flag now lives on the base class; re-run dialog sync whenever it flips.
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
    if (
      [
        'enabled',
        'role',
        'accountNonExpired',
        'accountNonLocked',
        'credentialsNonExpired',
      ].includes(field)
    ) {
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

  onCreate(): void {
    this.router.navigate(['/users/new'], { queryParamsHandling: 'preserve' });
  }

  onEdit(user: User): void {
    this.router.navigate(['/users', user.id, 'edit'], { queryParamsHandling: 'preserve' });
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

    // On mobile the routed UserForm component takes the whole view; skip the dialog flow
    // and tear down any dialog that was open before a viewport change.
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
    this.openDialog(UserForm, 'Create User', {
      isEditMode: false,
      successMessage: {
        severity: 'success',
        summary: 'Created',
        detail: 'User created successfully',
      },
    });

    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe(
        (
          result:
            | { user?: User; message?: { severity: string; summary: string; detail: string } }
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

  private openEditDialog(userId: number): void {
    this.openDialog(UserForm, 'Edit User', {
      userId,
      isEditMode: true,
      successMessage: {
        severity: 'success',
        summary: 'Updated',
        detail: 'User updated successfully',
      },
    });

    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe(
        (
          result:
            | { user?: User; message?: { severity: string; summary: string; detail: string } }
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
    this.router.navigate(['/users'], { queryParamsHandling: 'preserve' });
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
            this.errorHandler.showError(error, 'Failed to delete user');
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

    this.selectedSort.set(sortParam);
    this.filterSort.set(sortParam ? [sortParam] : []);

    this.loadData();
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
