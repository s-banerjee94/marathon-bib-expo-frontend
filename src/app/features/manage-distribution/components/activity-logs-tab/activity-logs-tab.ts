import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TooltipModule } from 'primeng/tooltip';
import { DistributionLogResponse, LogSearchType } from '../../../../core/models/distribution.model';
import { User, UserRole } from '../../../../core/models/user.model';
import { DistributionService } from '../../../../core/services/distribution.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import {
  LOG_ACTION_OPTIONS,
  LOG_SEARCH_TYPES,
  LogActionOption,
  LogSearchOption,
} from '../../../../shared/constants/distribution.constant';
import {
  BUTTON_SIZE,
  FORM_INPUT_SIZE,
  PAGINATION_LIMIT,
} from '../../../../shared/constants/form.constants';

@Component({
  selector: 'app-activity-logs-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    MessageModule,
    SelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    TooltipModule,
    DefaultValuePipe,
  ],
  templateUrl: './activity-logs-tab.html',
})
export class ActivityLogsTab implements OnChanges {
  private distributionService = inject(DistributionService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() eventId: number | undefined;
  @Input() organizationId: number | undefined;

  buttonSize = BUTTON_SIZE;
  inputSize = FORM_INPUT_SIZE;
  skeletonRows = Array(8).fill({});

  logSearchTypes = LOG_SEARCH_TYPES;
  selectedSearchType = signal<LogSearchType>('BIB');
  searchValue = signal<string>('');
  dropdownSelectedItem = signal<string>('');
  isSearchMode = signal(false);

  // Action dropdown — fixed values
  actionOptions: LogActionOption[] = LOG_ACTION_OPTIONS;

  // Performed By dropdown — loaded from org users
  orgUsers = signal<User[]>([]);
  isUsersLoading = signal(false);

  // Maps each user to { label: "Full Name (username)", value: "id" } for the PERFORMED_BY search
  performedByOptions = computed(() =>
    this.orgUsers().map((user) => ({
      label: `${user.fullName} (${user.username})`,
      value: String(user.id),
    })),
  );

  // True when current search type uses a dropdown instead of a text input
  isDropdownSearch = computed(
    () => this.selectedSearchType() === 'ACTION' || this.selectedSearchType() === 'PERFORMED_BY',
  );

  logs = signal<DistributionLogResponse[]>([]);
  loadedCount = signal(0);
  /** True only on the very first load (no data yet) */
  loading = signal(false);
  /** True when silently refreshing in the background (data still visible) */
  refreshing = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  lastEvaluatedKey = signal<string | undefined>(undefined);
  loaded = signal(false);

  isInitialLoading = computed(() => this.loading() && this.logs().length === 0);
  isLoadingMore = computed(() => this.loading() && this.logs().length > 0);

  searchPlaceholder = computed(() => {
    const option = this.logSearchTypes.find(
      (t: LogSearchOption) => t.value === this.selectedSearchType(),
    );
    return option?.placeholder ?? 'Enter search value';
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId']) {
      this.resetAndLoad();
    }
    if (changes['eventId'] || changes['organizationId']) {
      if (this.eventId) {
        this.loadOrgUsers();
      } else {
        this.orgUsers.set([]);
      }
    }
  }

  onSearchTypeChange(newType: LogSearchType): void {
    this.selectedSearchType.set(newType);
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
  }

  performSearch(): void {
    const isDropdown = this.isDropdownSearch();
    const value = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();
    if (!value || (!isDropdown && value.length < 2) || !this.eventId) return;

    this.logs.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.error.set(null);
    this.isSearchMode.set(true);
    this.doFetch();
  }

  clearSearch(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.selectedSearchType.set('BIB');
    this.isSearchMode.set(false);
    this.logs.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.hasMore.set(false);
    this.error.set(null);
    this.loaded.set(false);
    if (this.eventId) this.doFetch();
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading() || this.refreshing()) return;
    this.doFetch();
  }

  /**
   * Keeps existing rows visible while fetching — replaces data when done.
   */
  reload(): void {
    const eventId = this.eventId;
    if (!eventId || this.refreshing()) return;

    const limit = Math.max(this.logs().length, PAGINATION_LIMIT);
    this.refreshing.set(true);
    this.error.set(null);

    const searchValue = this.isDropdownSearch()
      ? this.dropdownSelectedItem()
      : this.searchValue().trim();
    const request$ = this.isSearchMode()
      ? this.distributionService.lookupLogs(eventId, this.selectedSearchType(), searchValue, limit)
      : this.distributionService.getDistributionLogs(eventId, limit);

    request$.subscribe({
      next: (response) => {
        this.logs.set(response.logs);
        this.loadedCount.set(response.logs.length);
        this.hasMore.set(response.hasMore);
        this.lastEvaluatedKey.set(response.lastEvaluatedKey);
        this.loaded.set(true);
        this.refreshing.set(false);
      },
      error: (err) => {
        this.refreshing.set(false);
        this.error.set('Failed to refresh. Please try again.');
        this.errorHandler.showError(err, 'Failed to load activity logs');
      },
    });
  }

  private resetAndLoad(): void {
    this.logs.set([]);
    this.loadedCount.set(0);
    this.lastEvaluatedKey.set(undefined);
    this.hasMore.set(false);
    this.error.set(null);
    this.loaded.set(false);
    this.isSearchMode.set(false);
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.selectedSearchType.set('BIB');
    if (this.eventId) this.doFetch();
  }

  private doFetch(limit = PAGINATION_LIMIT): void {
    const eventId = this.eventId;
    if (!eventId) return;

    this.loading.set(true);

    const searchValue = this.isDropdownSearch()
      ? this.dropdownSelectedItem()
      : this.searchValue().trim();
    const request$ = this.isSearchMode()
      ? this.distributionService.lookupLogs(
          eventId,
          this.selectedSearchType(),
          searchValue,
          limit,
          this.lastEvaluatedKey(),
        )
      : this.distributionService.getDistributionLogs(eventId, limit, this.lastEvaluatedKey());

    request$.subscribe({
      next: (response) => {
        this.logs.update((prev) => [...prev, ...response.logs]);
        this.loadedCount.set(this.logs().length);
        this.hasMore.set(response.hasMore);
        this.lastEvaluatedKey.set(response.lastEvaluatedKey);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Failed to load activity logs. Please try again.');
        this.errorHandler.showError(err, 'Failed to load activity logs');
      },
    });
  }

  private loadOrgUsers(): void {
    this.isUsersLoading.set(true);

    const isRootOrAdmin = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

    // ROOT/ADMIN must filter by organizationId via the pageable endpoint;
    // org-scoped roles use the /organization endpoint (auto-scoped to their org).
    const users$ = isRootOrAdmin
      ? this.userService
          .searchUsers({ organizationId: this.organizationId, size: 200, page: 0 })
          .pipe(map((response) => response.content))
      : this.userService.getOrganizationUsers({ enabled: true });

    users$.subscribe({
      next: (users) => {
        this.orgUsers.set(users);
        this.isUsersLoading.set(false);
      },
      error: () => {
        this.isUsersLoading.set(false);
      },
    });
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      BIB_COLLECTED: 'BIB Collected',
      BIB_UNDONE: 'BIB Undone',
      GOODIES_DISTRIBUTED: 'Goodies Distributed',
      GOODIES_UNDONE: 'Goodies Undone',
    };
    return labels[action] ?? action;
  }

  getActionSeverity(action: string): 'success' | 'danger' | 'info' | 'warn' {
    const map: Record<string, 'success' | 'danger' | 'info' | 'warn'> = {
      BIB_COLLECTED: 'success',
      BIB_UNDONE: 'danger',
      GOODIES_DISTRIBUTED: 'info',
      GOODIES_UNDONE: 'warn',
    };
    return map[action] ?? 'info';
  }

  getStaffUsername(value?: string): string {
    if (!value) return '--';
    const parts = value.split('__|__');
    return parts.length > 1 ? parts[1] : value;
  }
}
