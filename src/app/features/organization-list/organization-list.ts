import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { TagModule } from 'primeng/tag';
import { FloatLabelModule } from 'primeng/floatlabel';

import { Organization } from '../../core/models/organization.model';
import { PageableParams } from '../../core/models/api.model';
import { OrganizationService } from '../../core/services/organization.service';
import { ORGANIZATION_COLUMNS } from '../../shared/constants/organization-columns.constant';
import { STORAGE_KEYS } from '../../shared/constants/storage-keys.constant';
import { ORGANIZATION_SORT_OPTIONS } from '../../shared/constants/sort-options.constant';
import { OrganizationForm } from '../organization-form/organization-form';
import { DefaultValuePipe } from '../../shared/pipes/default-value.pipe';
import { BaseTableComponent } from '../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../shared/models/table-config.model';

interface OrganizationFilterPreferences extends TableFilterPreferences {
  enabled: boolean;
  deleted: boolean;
  sort: string[];
}

@Component({
  selector: 'app-organization-list',
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
    FloatLabelModule,
    DefaultValuePipe,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './organization-list.html',
  styleUrl: './organization-list.css',
})
export class OrganizationList extends BaseTableComponent<
  Organization,
  OrganizationFilterPreferences
> {
  // Organization-specific filter
  filterDeleted = signal(false);
  // Organization-specific sort options
  readonly sortOptions = ORGANIZATION_SORT_OPTIONS;
  // Base class requirements
  protected override columnPreferenceKey = STORAGE_KEYS.ORG_TABLE_COLUMNS;
  protected override filterPreferenceKey = STORAGE_KEYS.ORG_TABLE_FILTERS;
  protected override allColumns = ORGANIZATION_COLUMNS;
  togglingOrgId = signal<number | null>(null);
  private organizationService = inject(OrganizationService);
  private confirmationService = inject(ConfirmationService);

  constructor() {
    super();
    this.initializeColumns();
  }

  getSubscriptionTierSeverity(tier: string): 'danger' | 'success' | 'info' | 'warn' | 'secondary' {
    switch (tier?.toUpperCase()) {
      case 'ENTERPRISE':
        return 'danger';
      case 'PREMIUM':
        return 'success';
      case 'BASIC':
        return 'info';
      case 'FREE':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  getSubscriptionStatusSeverity(
    status: string,
  ): 'danger' | 'success' | 'info' | 'warn' | 'secondary' {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'success';
      case 'EXPIRED':
      case 'CANCELLED':
        return 'danger';
      case 'TRIAL':
        return 'info';
      case 'PENDING':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  getColumnAlignment(field: string): string {
    // Center alignment for status/tag columns
    if (['enabled', 'deleted', 'subscriptionTier', 'subscriptionStatus'].includes(field)) {
      return 'text-center';
    }
    // Right alignment for numeric columns
    if (['id', 'maxEvents', 'maxParticipantsPerEvent'].includes(field)) {
      return 'text-right';
    }
    // Left alignment for all other columns (default)
    return '';
  }

  toggleOrgStatus(event: Event, org: Organization): void {
    const action = org.enabled ? 'disable' : 'enable';
    const warning = org.enabled ? ' This will also disable all users of this organization.' : '';

    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: `Do you want to ${action} "${org.organizerName}"?${warning}`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: org.enabled ? 'Disable' : 'Enable',
        severity: org.enabled ? 'warn' : 'success',
      },
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      accept: () => {
        this.togglingOrgId.set(org.id);

        this.organizationService.toggleStatus(org.id, !org.enabled).subscribe({
          next: (updatedOrg) => {
            this.entities.set(
              this.entities().map((o) => (o.id === updatedOrg.id ? updatedOrg : o)),
            );
            this.togglingOrgId.set(null);
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: `Organization ${updatedOrg.enabled ? 'enabled' : 'disabled'} successfully`,
            });
          },
          error: (error) => {
            this.togglingOrgId.set(null);
            this.errorHandler.showError(error, 'Failed to update organization status');
          },
        });
      },
    });
  }

  onCreate(): void {
    this.openDialog(OrganizationForm, 'Create Organization', {
      isEditMode: false,
      successMessage: {
        severity: 'success',
        summary: 'Created',
        detail: 'Organization created successfully',
      },
    });

    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe(
        (
          result:
            | {
                organization?: Organization;
                message?: { severity: string; summary: string; detail: string };
              }
            | undefined,
        ) => {
          // Add the new organization to the list locally if organization was created
          if (result?.organization) {
            const currentOrgs = this.entities();
            // Add to the beginning of the list
            this.entities.set([result.organization, ...currentOrgs]);
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

  onEdit(org: Organization): void {
    this.openDialog(OrganizationForm, 'Edit Organization', {
      organizationId: org.id,
      isEditMode: true,
      successMessage: {
        severity: 'success',
        summary: 'Updated',
        detail: 'Organization updated successfully',
      },
    });

    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe(
        (
          result:
            | {
                organization?: Organization;
                message?: { severity: string; summary: string; detail: string };
              }
            | undefined,
        ) => {
          // Update the list locally if organization was updated
          if (result?.organization) {
            const currentOrgs = this.entities();
            const updatedOrgs = currentOrgs.map((o) =>
              o.id === result.organization!.id ? result.organization! : o,
            );
            this.entities.set(updatedOrgs);
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
    if (this.filterDeleted()) {
      params.deleted = true;
    }

    this.organizationService.searchOrganizations(params).subscribe({
      next: (response) => this.handleLoadSuccess(response),
      error: (error) => this.handleLoadError(error),
    });
  }

  protected override getDefaultFilterPreferences(): OrganizationFilterPreferences {
    return {
      enabled: true,
      deleted: false,
      sort: [],
    };
  }

  protected override getCurrentFilterPreferences(): OrganizationFilterPreferences {
    return {
      enabled: this.filterEnabled(),
      deleted: this.filterDeleted(),
      sort: this.filterSort(),
    };
  }

  protected override applyFilterPreferences(prefs: OrganizationFilterPreferences): void {
    this.filterEnabled.set(prefs.enabled);
    this.filterDeleted.set(prefs.deleted);
    this.filterSort.set(prefs.sort);
  }
}
