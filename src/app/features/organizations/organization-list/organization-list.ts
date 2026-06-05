import { Component, computed, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, ParamMap, Router } from '@angular/router';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Popover, PopoverModule } from 'primeng/popover';
import { TagModule } from 'primeng/tag';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ListShell } from '../../../shared/components/list/list-shell/list-shell';

import { Organization } from '../../../core/models/organization.model';
import { PageableParams, PageableResponse } from '../../../core/models/api.model';
import { OrganizationService } from '../../../core/services/organization.service';
import { ORGANIZATION_COLUMNS } from '../../../shared/constants/organization-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { ORGANIZATION_SORT_OPTIONS } from '../../../shared/constants/sort-options.constant';
import { OrganizationForm } from '../organization-form/organization-form';
import { OrganizationListBus, OrganizationMutation } from '../organization-list-bus.service';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { UserQuotaPipe } from '../../../shared/pipes/user-quota-pipe';
import { BaseTableComponent } from '../../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../../shared/models/table-config.model';

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
    CardModule,
    TooltipModule,
    SkeletonModule,
    CheckboxModule,
    SelectModule,
    ConfirmPopupModule,
    TagModule,
    FloatLabelModule,
    DefaultValuePipe,
    UserQuotaPipe,
    PopoverModule,
    ListShell,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './organization-list.html',
  styleUrl: './organization-list.css',
})
export class OrganizationList extends BaseTableComponent<
  Organization,
  OrganizationFilterPreferences
> {
  @ViewChild('quotaPopover') quotaPopover!: Popover;
  quotaOrg = signal<Organization | null>(null);

  showQuotaPopover(event: Event, org: Organization): void {
    this.quotaOrg.set(org);
    this.quotaPopover.toggle(event);
  }

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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private organizationListBus = inject(OrganizationListBus);
  // Drawer badge: count of filters set away from their defaults.
  activeFilterCount = computed(() => {
    let count = 0;
    if (!this.filterEnabled()) count++;
    if (this.filterDeleted()) count++;
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

    // Subscribe to the load pipeline BEFORE queryParamMap — the route observable emits the
    // current value synchronously on subscribe, which triggers loadTrigger.next() inside
    // applyUrlToState. If the switchMap subscription isn't active yet, that first emission is
    // dropped (Subject doesn't replay) and the initial fetch never fires.
    this.loadTrigger
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          const params = this.buildOrganizationSearchParams();
          return this.organizationService.searchOrganizations(params).pipe(
            catchError((error) => {
              this.handleLoadError(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: PageableResponse<Organization>) => this.handleLoadSuccess(response));

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

    this.organizationListBus.mutations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mutation) => this.applyOrganizationMutation(mutation));
  }

  private applyOrganizationMutation(mutation: OrganizationMutation): void {
    const current = this.entities();
    if (mutation.action === 'created') {
      this.entities.set([mutation.organization, ...current]);
      this.totalRecords.set(this.totalRecords() + 1);
    } else {
      const updated = current.map((o) =>
        o.id === mutation.organization.id ? mutation.organization : o,
      );
      this.entities.set(updated);
    }
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
            this.toast.success(
              `Organization ${updatedOrg.enabled ? 'enabled' : 'disabled'} successfully`,
              'Updated',
            );
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
    this.openCreateDialog();
  }

  onEdit(org: Organization): void {
    this.router.navigate(['/organizations', org.id, 'edit'], { queryParamsHandling: 'preserve' });
  }

  // Create always opens as a dialog (desktop and mobile alike — openDialog goes
  // full-width on small screens). On success OrganizationForm publishes to
  // OrganizationListBus, which prepends the new row in place; the list is never refetched.
  private openCreateDialog(): void {
    this.openDialog(OrganizationForm, 'Create Organization', {});
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
      deleted: this.filterDeleted() ? 'true' : null,
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

  private buildOrganizationSearchParams(): PageableParams {
    const params = this.buildPageableParams();
    if (this.filterDeleted()) {
      params.deleted = true;
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
    const deletedParam = params.get('deleted');
    const sortParam = params.get('sort');

    this.searchTerm.set(q);
    // URL page is 1-indexed (?page=2 = second page); convert to 0-indexed for backend/state.
    this.currentPage.set(Number.isFinite(pageParam) && pageParam > 1 ? pageParam - 1 : 0);
    this.pageSize.set(
      Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : this.DEFAULT_PAGE_SIZE,
    );
    this.filterEnabled.set(enabledParam !== 'false');
    this.filterDeleted.set(deletedParam === 'true');

    this.selectedSort.set(sortParam);
    this.filterSort.set(sortParam ? [sortParam] : []);

    this.loadData();

    // Dashboards deep-link here with ?create=true to start a new organization.
    // Strip the flag from the URL and open the (route-less) create dialog.
    if (params.get('create') === 'true') {
      this.pushStateToUrl({ create: null });
      this.openCreateDialog();
    }
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
