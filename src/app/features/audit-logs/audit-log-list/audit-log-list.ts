import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AuditLog, AuditLogQuery } from '../../../core/models/audit-log.model';
import { UserRole } from '../../../core/models/user.model';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ACTION_OPTIONS,
  AUDIT_ACTION_SEVERITY,
  AUDIT_ACTION_SEVERITY_DEFAULT,
  AUDIT_ENTITY_TYPE_LABEL,
  AUDIT_ENTITY_TYPE_OPTIONS,
  AUDIT_LOG_DEFAULT_RANGE_DAYS,
  AUDIT_LOG_RETENTION_DAYS,
  AUDIT_LOG_SKELETON_ROWS,
  AuditTagSeverity,
  resolveAuditActivityIcon,
} from '../../../shared/constants/audit-log.constant';
import { AuditEntityRoutePipe } from '../../../shared/pipes/audit-entity-route-pipe';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { UserSelector } from '../../../layout/user-selector/user-selector';
import { ListFilterPanel } from '../../../shared/components/list/list-filter-panel/list-filter-panel';
import { injectIsMobile } from '../../../shared/utils/responsive.utils';

function lastNDays(days: number): Date[] {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return [from, to];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    DatePickerModule,
    FloatLabelModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    AuditEntityRoutePipe,
    DefaultValuePipe,
    OrganizationSelector,
    UserSelector,
    ListFilterPanel,
  ],
  templateUrl: './audit-log-list.html',
})
export class AuditLogList implements OnInit {
  private auditLogService = inject(AuditLogService);
  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly skeletonRows = Array(4).fill(null);
  readonly tableSkeletonRows = Array(AUDIT_LOG_SKELETON_ROWS).fill(null);
  readonly actionOptions = AUDIT_ACTION_OPTIONS;
  readonly entityTypeOptions = AUDIT_ENTITY_TYPE_OPTIONS;
  // Picker clamp — anything older than the backend's retention window won't return data.
  readonly minDate = daysAgo(AUDIT_LOG_RETENTION_DAYS);
  readonly maxDate = endOfToday();

  isMobile = injectIsMobile();

  // Accumulated feed (newest first), plus the cursor state that drives "Load more".
  items = signal<AuditLog[]>([]);
  isLoading = signal(false);
  isLoadingMore = signal(false);
  hasLoadedOnce = signal(false);
  errorMessage = signal<string | null>(null);
  private cursor = signal<string | null>(null);
  hasMore = signal(false);

  // Filters
  dateRange = signal<Date[] | null>(lastNDays(AUDIT_LOG_DEFAULT_RANGE_DAYS));
  filterAction = signal<string | null>(null);
  filterEntityType = signal<string | null>(null);
  filterUsername = signal<string | null>(null);
  // ROOT/ADMIN only
  filterOrganizationId = signal<number | null>(null);
  // ROOT/ADMIN only: when on, the request goes out as organizationId=0 and the
  // backend returns only system events (ROOT-managed admin actions, actors
  // without an org, LOGINs without an org). Other filters are visually disabled
  // — the date range still applies.
  filterSystemEventsOnly = signal(false);

  isPrivileged = computed(() => this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]));

  // What we pass to the UserSelector's `organizationId` input:
  //  - Organizers are pinned to their own org (backend enforces, but we mirror it
  //    in the UI so the picker can't list users they can't see anyway).
  //  - ROOT/ADMIN: whatever's chosen in the org filter, or null when nothing is
  //    picked (the selector treats null as "search system-wide").
  userPickerOrgId = computed<number | null>(() => {
    if (this.isPrivileged()) {
      return this.filterOrganizationId();
    }
    return this.authService.currentUser()?.organizationId ?? null;
  });

  // Mutual exclusion: only one of {action, user, entityType} can be active at a time.
  // When "system events only" is on, everything other than the date range is locked.
  actionDisabled = computed(
    () =>
      this.filterSystemEventsOnly() ||
      this.filterUsername() !== null ||
      this.filterEntityType() !== null,
  );
  entityTypeDisabled = computed(
    () =>
      this.filterSystemEventsOnly() ||
      this.filterAction() !== null ||
      this.filterUsername() !== null,
  );
  userPickerDisabled = computed(
    () =>
      this.filterSystemEventsOnly() ||
      this.filterAction() !== null ||
      this.filterEntityType() !== null,
  );
  // The org selector binds to this directly — locked while system-events is on.
  orgSelectorDisabled = computed(() => this.filterSystemEventsOnly());

  showEmptyState = computed(
    () =>
      this.hasLoadedOnce() &&
      !this.isLoading() &&
      !this.errorMessage() &&
      this.items().length === 0,
  );

  showErrorState = computed(
    () => !this.isLoading() && !!this.errorMessage() && this.items().length === 0,
  );

  // Drives the badge next to the mobile "Filters" button — counts only non-default filters
  // (date range is excluded because it always has a 7-day default).
  activeFilterCount = computed(() => {
    // When system events only is on, that override is the single active filter
    // and locks the rest out — counting just it keeps the badge honest.
    if (this.filterSystemEventsOnly()) return 1;
    let count = 0;
    if (this.filterAction() !== null) count++;
    if (this.filterEntityType() !== null) count++;
    if (this.filterUsername() !== null) count++;
    if (this.isPrivileged() && this.filterOrganizationId() !== null) count++;
    return count;
  });

  ngOnInit(): void {
    this.resetAndLoad();
  }

  onActionChange(value: string | null): void {
    this.filterAction.set(value);
    this.maybeReload();
  }

  onEntityTypeChange(value: string | null): void {
    this.filterEntityType.set(value);
    this.maybeReload();
  }

  onDateRangeChange(value: Date[] | null): void {
    this.dateRange.set(value);
    // Range mode emits [start] mid-selection; only refetch once both ends exist (or it's cleared).
    if (!value || value.length === 0 || value[1]) {
      this.maybeReload();
    }
  }

  onOrganizationFilterChange(value: number | undefined): void {
    this.filterOrganizationId.set(value ?? null);
    // Drop any stale username in case the previous pick was from a different
    // org. The UserSelector handles its own internal reset when its
    // `organizationId` input changes; we just need to mirror that in our
    // filterUsername so buildQuery doesn't carry forward a now-invalid value.
    this.filterUsername.set(null);
    this.maybeReload();
  }

  onSystemEventsOnlyChange(value: boolean): void {
    this.filterSystemEventsOnly.set(value);
    // We intentionally leave the other filter values in place — they're just
    // disabled visually and ignored by buildQuery() while this is on. When the
    // user unchecks, their previous filters come right back.
    this.maybeReload();
  }

  // On mobile, filter edits sit in signals until the user taps Apply — avoids
  // firing a request per keystroke and stops the picker overlay from reopening
  // after each refetch. Desktop keeps the instant-feedback behavior.
  onApplyFilters(): void {
    this.resetAndLoad();
  }

  private maybeReload(): void {
    if (this.isMobile()) {
      return;
    }
    this.resetAndLoad();
  }

  onUserPickerUsernameChange(username: string | null): void {
    // The selector also emits null when its org scope changes — skip a
    // duplicate reload if our filter is already aligned.
    if (this.filterUsername() === username) {
      return;
    }
    this.filterUsername.set(username);
    this.maybeReload();
  }

  refresh(): void {
    this.resetAndLoad();
  }

  loadMore(): void {
    if (this.hasMore() && !this.isLoadingMore()) {
      this.fetch(true);
    }
  }

  getActionSeverity(action: string): AuditTagSeverity {
    return AUDIT_ACTION_SEVERITY[action] ?? AUDIT_ACTION_SEVERITY_DEFAULT;
  }

  getActionLabel(action: string): string {
    return AUDIT_ACTION_LABEL[action] ?? action;
  }

  getEntityTypeLabel(entityType: string): string {
    return AUDIT_ENTITY_TYPE_LABEL[entityType] ?? entityType;
  }

  // PrimeIcon class for the activity-row badge — mirrors the dashboard Recent Activity card.
  getActivityIcon(action: string, entityType: string): string {
    return resolveAuditActivityIcon(action, entityType);
  }

  private resetAndLoad(): void {
    this.cursor.set(null);
    this.hasMore.set(false);
    this.fetch(false);
  }

  private fetch(isLoadMore: boolean): void {
    if (isLoadMore) {
      this.isLoadingMore.set(true);
    } else {
      this.isLoading.set(true);
      this.errorMessage.set(null);
    }

    const query = this.buildQuery(isLoadMore ? this.cursor() : null);

    this.auditLogService.search(query).subscribe({
      next: (response) => {
        const incoming = response.items ?? [];
        this.items.set(isLoadMore ? [...this.items(), ...incoming] : incoming);
        this.cursor.set(response.lastEvaluatedKey);
        this.hasMore.set(!!response.hasMore && !!response.lastEvaluatedKey);
        this.hasLoadedOnce.set(true);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: (error) => {
        if (isLoadMore) {
          // Keep the rows already shown; surface the failure as a toast.
          this.errorHandler.showError(error, 'Failed to load more audit logs');
        } else {
          // Initial fetch / filter apply: keep the inline message in the empty-state
          // panel AND surface a toast so the user sees it even if they're scrolled.
          this.items.set([]);
          this.errorMessage.set(this.errorHandler.extract(error).detail);
          this.errorHandler.showError(error, 'Failed to load audit logs');
        }
        this.hasMore.set(false);
        this.hasLoadedOnce.set(true);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  private buildQuery(cursor: string | null): AuditLogQuery {
    // No explicit `limit` — the backend default (50) is what we want.
    const query: AuditLogQuery = {};

    // "System events only" is a ROOT/ADMIN override — sends organizationId=0
    // and skips every other filter dimension (date range still applies).
    if (this.isPrivileged() && this.filterSystemEventsOnly()) {
      query.organizationId = 0;
    } else {
      if (this.filterAction()) {
        query.action = this.filterAction()!;
      }
      if (this.filterEntityType()) {
        query.entityType = this.filterEntityType()!;
      }
      if (this.filterUsername()) {
        query.username = this.filterUsername()!;
      }
      if (this.isPrivileged() && this.filterOrganizationId() !== null) {
        query.organizationId = this.filterOrganizationId()!;
      }
    }

    const range = this.dateRange();
    if (range?.[0]) {
      const from = new Date(range[0]);
      from.setHours(0, 0, 0, 0);
      query.from = from.toISOString();

      const endSource = range[1] ?? range[0];
      const to = new Date(endSource);
      to.setHours(23, 59, 59, 999);
      query.to = to.toISOString();
    }

    if (cursor) {
      query.lastEvaluatedKey = cursor;
    }

    return query;
  }
}
