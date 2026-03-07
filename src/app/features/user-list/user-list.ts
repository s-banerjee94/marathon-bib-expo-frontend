import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Popover, PopoverModule } from 'primeng/popover';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { SkeletonModule } from 'primeng/skeleton';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { FloatLabelModule } from 'primeng/floatlabel';

import { User, UserRole } from '../../core/models/user.model';
import { PageableParams } from '../../core/models/api.model';
import { UserService } from '../../core/services/user.service';
import { OrganizationService } from '../../core/services/organization.service';
import { Organization } from '../../core/models/organization.model';
import { USER_COLUMNS } from '../../shared/constants/user-columns.constant';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { USER_SORT_OPTIONS } from '../../shared/constants/sort-options.constant';
import { UserForm } from '../user-form/user-form';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { BaseTableComponent } from '../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../shared/models/table-config.model';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';

interface UserFilterPreferences extends TableFilterPreferences {
  enabled: boolean;
  includeDeleted: boolean;
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
    MultiSelectModule,
    TooltipModule,
    PopoverModule,
    DividerModule,
    ConfirmPopupModule,
    SkeletonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    CheckboxModule,
    SelectModule,
    TagModule,
    FloatLabelModule,
    DefaultValuePipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList extends BaseTableComponent<User, UserFilterPreferences> {
  @ViewChild('orgPopover') orgPopover!: Popover;
  // User-specific filter
  filterIncludeDeleted = signal(false);
  // Organization popover state
  organizationCache = new Map<number, Organization>();
  loadingOrganizationId = signal<number | null>(null);
  currentOrganizationDetails = signal<Organization | null>(null);
  // Toggle enabled state
  togglingUserId = signal<number | null>(null);
  // User-specific sort options
  readonly sortOptions = USER_SORT_OPTIONS;
  // Base class requirements
  protected override columnPreferenceKey = STORAGE_KEYS.USER_TABLE_COLUMNS;
  protected override filterPreferenceKey = STORAGE_KEYS.USER_TABLE_FILTERS;
  protected override allColumns = USER_COLUMNS;
  private userService = inject(UserService);
  private organizationService = inject(OrganizationService);
  private confirmationService = inject(ConfirmationService);

  constructor() {
    super();
    this.initializeColumns();
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
    if (['enabled', 'deleted', 'role'].includes(field)) {
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
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: `User ${updatedUser.enabled ? 'enabled' : 'disabled'} successfully`,
            });
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
          // Add the new user to the list locally if user was created
          if (result?.user) {
            const currentUsers = this.entities();
            // Add to the beginning of the list
            this.entities.set([result.user, ...currentUsers]);
            // Update total records
            this.totalRecords.set(this.totalRecords() + 1);
            // Show success toast with custom message
            if (result.message) {
              this.messageService.add(result.message);
            }
          }
        },
      );
    }
  }

  onEdit(user: User): void {
    this.openDialog(UserForm, 'Edit User', {
      userId: user.id,
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
          // Update the list locally if user was updated
          if (result?.user) {
            const currentUsers = this.entities();
            const updatedUsers = currentUsers.map((u) =>
              u.id === result.user!.id ? result.user! : u,
            );
            this.entities.set(updatedUsers);
            // Show success toast with custom message
            if (result.message) {
              this.messageService.add(result.message);
            }
          }
        },
      );
    }
  }

  protected override loadData(): void {
    this.isLoading.set(true);

    const params = this.buildPageableParams();
    if (this.filterIncludeDeleted()) {
      params.includeDeleted = true;
    }

    this.userService.searchUsers(params).subscribe({
      next: (response) => this.handleLoadSuccess(response),
      error: (error) => this.handleLoadError(error),
    });
  }

  protected override getDefaultFilterPreferences(): UserFilterPreferences {
    return {
      enabled: true,
      includeDeleted: false,
      sort: [],
    };
  }

  protected override getCurrentFilterPreferences(): UserFilterPreferences {
    return {
      enabled: this.filterEnabled(),
      includeDeleted: this.filterIncludeDeleted(),
      sort: this.filterSort(),
    };
  }

  protected override applyFilterPreferences(prefs: UserFilterPreferences): void {
    this.filterEnabled.set(prefs.enabled);
    this.filterIncludeDeleted.set(prefs.includeDeleted);
    this.filterSort.set(prefs.sort);
  }
}
