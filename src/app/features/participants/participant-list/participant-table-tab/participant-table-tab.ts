import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule, ButtonSeverity } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule, MultiSelectChangeEvent } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { ConfirmationService } from 'primeng/api';
import { Participant } from '../../../../core/models/participant.model';
import { EventService } from '../../../../core/services/event.service';
import { ParticipantService } from '../../../../core/services/participant.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LocalStorageService } from '../../../../core/services/local-storage.service';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import {
  formatGoodiesKey,
  getGenderDisplay,
  getGenderSeverity,
  parseDob,
} from '../../../../shared/utils/participant.utils';
import {
  BUTTON_SIZE,
  FORM_INPUT_SIZE,
  PAGINATION_LIMIT,
} from '../../../../shared/constants/form.constants';
import {
  BULK_DELETE_MAX_LIMIT,
  LOOKUP_SEARCH_TYPES,
  PARTICIPANT_COLUMNS,
} from '../../../../shared/constants/participant-columns.constant';
import { STORAGE_KEYS } from '../../../../shared/constants/storage-keys.constant';
import { TableColumn } from '../../../../shared/models/table-config.model';
import { ParticipantListState } from '../participant-list-state.service';

@Component({
  selector: 'app-participant-table-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-table-tab.html',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
    SelectModule,
    MultiSelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    PopoverModule,
    DividerModule,
    DefaultValuePipe,
  ],
})
export class ParticipantTableTab {
  private participantService = inject(ParticipantService);
  private eventService = inject(EventService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private storage = inject(LocalStorageService);
  private confirmationService = inject(ConfirmationService);
  private listState = inject(ParticipantListState);

  // Router-bound input — the parent route is `event/:eventId`. Accepts string (from
  // router path params) or number (when bound directly by a host component).
  eventId = input.required<number, number | string>({ transform: (v) => Number(v) });

  // Feature flags — hosts can hide the action toolbar and/or selection column.
  showActionToolbar = input<boolean>(true);
  showSelectionColumn = input<boolean>(true);

  // Outputs replace the previous `parent.openX()` coupling so the table-tab
  // can be hosted anywhere (standalone /participants page, event-details tab, etc.).
  importRequested = output<void>();
  createRequested = output<void>();
  exportRequested = output<void>();
  // Row action: view + edit are unified into a single Details action. The host
  // decides whether the details view is editable based on the route context.
  detailsRequested = output<Participant>();

  // Constants
  buttonSize = BUTTON_SIZE;
  inputSize = FORM_INPUT_SIZE;
  allColumns: TableColumn[] = PARTICIPANT_COLUMNS;
  lookupSearchTypes = LOOKUP_SEARCH_TYPES;

  getGenderDisplay = getGenderDisplay;
  getGenderSeverity = getGenderSeverity;
  parseDob = parseDob;
  formatGoodiesKey = formatGoodiesKey;

  // Data state — backed by the host-scoped cache so it survives this tab being
  // destroyed/re-created while a details/create dialog is open (no reload on close).
  participants = this.listState.participants;
  totalCount = this.listState.totalCount;
  isLoading = signal(false);
  hasMore = this.listState.hasMore;
  // Pagination cursor proxied to the shared cache (survives tab re-creation).
  private get lastEvaluatedKey(): string | undefined {
    return this.listState.lastEvaluatedKey;
  }
  private set lastEvaluatedKey(value: string | undefined) {
    this.listState.lastEvaluatedKey = value;
  }

  // Search state (cached so a filtered view is preserved across dialog open/close)
  selectedSearchType = this.listState.selectedSearchType;
  searchValue = this.listState.searchValue;
  dropdownSelectedItem = this.listState.dropdownSelectedItem;
  // Race chosen to scope the CATEGORY dropdown (category lookup is a two-step pick).
  categoryRaceId = this.listState.categoryRaceId;
  isSearchMode = this.listState.isSearchMode;

  // Race / Category dropdown data (for race/category search modes)
  races = this.listState.races;
  categories = this.listState.categories;
  isRacesLoading = signal(false);

  isDropdownSearch = computed(
    () => this.selectedSearchType() === 'RACE' || this.selectedSearchType() === 'CATEGORY',
  );

  // Lookup by race/category sends IDS, not names: RACE → raceId,
  // CATEGORY → `raceId#categoryId` (HttpParams URL-encodes the `#` as %23).
  // The label still shows the human-readable name.
  raceOptions = computed(() =>
    this.races().map((r) => ({ label: r.raceName, value: String(r.id) })),
  );
  // CATEGORY lookup is scoped to the race picked in `categoryRaceId`, so the
  // category dropdown only lists that race's categories (names can repeat across races).
  categoryOptions = computed(() => {
    const raceId = this.categoryRaceId();
    if (raceId == null) return [];
    return this.categories()
      .filter((c) => c.raceId === raceId)
      .map((c) => ({ label: c.categoryName, value: `${c.raceId}#${c.id}` }));
  });

  searchPlaceholder = computed(() => {
    const option = this.lookupSearchTypes.find((t) => t.value === this.selectedSearchType());
    return option?.placeholder || 'Enter search value';
  });

  // Column selection state — persisted to localStorage
  selectedCols = signal<TableColumn[]>([]);

  visibleCols = computed(() => {
    const selected = this.selectedCols();
    const required = this.allColumns.filter((col) => col.required);
    const selectedFields = new Set(selected.map((col) => col.field));
    const requiredFields = new Set(required.map((col) => col.field));
    return this.allColumns.filter(
      (col) => requiredFields.has(col.field) || selectedFields.has(col.field),
    );
  });

  availableColumns = computed(() =>
    this.allColumns.map((col) => ({ ...col, disabled: col.required })),
  );

  // Selection (PrimeNG two-way binding needs a regular array)
  selectedParticipants: Participant[] = [];

  // Skeleton rows for initial loading state
  skeletonRows = Array(5).fill({});

  // Virtual scroll: fixed row height (px). Must match the body <tr> height so the
  // scroller's geometry stays accurate (px, not rem, since the app scales the root
  // font-size). Only the visible window of rows is ever in the DOM.
  protected readonly virtualRowHeight = 48;
  // Prefetch the next cursor page once the user scrolls within this many rows of the
  // end of the currently-loaded set.
  private readonly virtualScrollPrefetch = 15;

  isInitialLoading = computed(() => this.isLoading() && this.participants().length === 0);
  isLoadingMore = computed(() => this.isLoading() && this.participants().length > 0);

  constructor() {
    // Initialize selected columns from localStorage (or all columns by default).
    this.initializeSelectedColumns();

    // Effect 1: react to eventId changes — load on a genuine event switch, but
    // restore from the cache when this tab is simply re-created for the same event
    // (e.g., a details/create dialog closed), so the list never re-fetches.
    effect(() => {
      const id = this.eventId();
      untracked(() => {
        if (id && this.listState.isCachedFor(id)) return;

        this.resetData();
        if (id) {
          this.listState.markLoaded(id);
          this.loadEventData(id);
          this.loadParticipants();
          this.loadTotalCount();
        } else {
          this.races.set([]);
          this.categories.set([]);
        }
      });
    });

    // Effect 2: react to cross-tab reload triggers (e.g., after import completion).
    effect(() => {
      if (this.listState.reloadTrigger() > 0) {
        untracked(() => this.reloadParticipants());
      }
    });
  }

  // ---------- Data loading ----------
  private loadParticipants(append: boolean = false): void {
    const eventId = this.eventId();
    if (!eventId || this.isLoading()) return;

    this.isLoading.set(true);

    this.participantService
      .getParticipants(eventId, PAGINATION_LIMIT, append ? this.lastEvaluatedKey : undefined)
      .subscribe({
        next: (response) => {
          if (append) {
            this.participants.update((current) => [...current, ...response.participants]);
          } else {
            this.participants.set(response.participants);
          }
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load participants');
          this.isLoading.set(false);
        },
      });
  }

  private reloadParticipants(): void {
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.selectedParticipants = [];
    this.loadParticipants();
    this.loadTotalCount();
  }

  private loadTotalCount(): void {
    const eventId = this.eventId();
    if (!eventId) return;

    this.participantService.getParticipantCount(eventId).subscribe({
      next: (response) => this.totalCount.set(response.count),
      error: (error) => this.errorHandler.showError(error, 'Failed to load participant count'),
    });
  }

  private resetData(): void {
    this.listState.resetCache();
    this.selectedParticipants = [];
  }

  private loadEventData(eventId: number): void {
    this.isRacesLoading.set(true);
    this.eventService.getRaces(eventId).subscribe({
      next: (races) => {
        this.races.set(races);
        this.isRacesLoading.set(false);
        if (races.length > 0) {
          const catObs = races.map((r) => this.eventService.getCategoriesByRace(eventId, r.id));
          forkJoin(catObs).subscribe({
            next: (results) => this.categories.set(results.flat()),
            error: () => {},
          });
        }
      },
      error: () => this.isRacesLoading.set(false),
    });
  }

  // ---------- Search ----------
  onSearchTypeChange(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.categoryRaceId.set(null);
  }

  // CATEGORY mode: changing the race scope clears the previously picked category.
  onCategoryRaceChange(): void {
    this.dropdownSelectedItem.set('');
  }

  performSearch(): void {
    const eventId = this.eventId();
    const isDropdown = this.isDropdownSearch();
    const value = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();
    if (!eventId || !value || (!isDropdown && value.length < 2)) return;

    this.isSearchMode.set(true);
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.isLoading.set(true);

    this.participantService
      .lookupParticipants({
        eventId,
        searchType: this.selectedSearchType(),
        searchValue: value,
        limit: PAGINATION_LIMIT,
      })
      .subscribe({
        next: (response) => {
          this.participants.set(response.participants);
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to lookup participants');
          this.isLoading.set(false);
        },
      });
  }

  clearSearch(): void {
    this.resetSearch();
    this.participants.set([]);
    this.hasMore.set(true);
    this.lastEvaluatedKey = undefined;
    this.loadParticipants();
  }

  private resetSearch(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.categoryRaceId.set(null);
    this.selectedSearchType.set('BIB');
    this.isSearchMode.set(false);
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoading()) return;
    if (this.isSearchMode()) {
      this.loadMoreLookupResults();
    } else {
      this.loadParticipants(true);
    }
  }

  // Virtual scroll fires this as the visible window moves. We use it purely as a
  // near-end trigger for cursor-based infinite loading (not offset paging): once the
  // last visible row is within `virtualScrollPrefetch` of the loaded set, fetch the
  // next page. loadMore() itself guards hasMore/isLoading and routes search vs default.
  onVirtualScroll(event: TableLazyLoadEvent): void {
    if (this.isInitialLoading()) return;
    const last = event.last ?? 0;
    if (last >= this.participants().length - this.virtualScrollPrefetch) {
      this.loadMore();
    }
  }

  private loadMoreLookupResults(): void {
    const eventId = this.eventId();
    const isDropdown = this.isDropdownSearch();
    const value = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();
    if (!eventId || !value || !this.lastEvaluatedKey) return;

    this.isLoading.set(true);
    this.participantService
      .lookupParticipants({
        eventId,
        searchType: this.selectedSearchType(),
        searchValue: value,
        limit: PAGINATION_LIMIT,
        lastEvaluatedKey: this.lastEvaluatedKey,
      })
      .subscribe({
        next: (response) => {
          this.participants.update((current) => [...current, ...response.participants]);
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load more participants');
          this.isLoading.set(false);
        },
      });
  }

  // ---------- Delete (single + bulk) ----------
  onDelete(participant: Participant): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete participant ${participant.fullName} (BIB: ${participant.bibNumber})?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        const eventId = this.eventId();
        if (!eventId) return;

        this.participantService.deleteParticipant(eventId, participant.bibNumber).subscribe({
          next: () => {
            this.toast.success('Participant deleted successfully', 'Success');
            this.removeParticipantFromList(participant.bibNumber);
            this.totalCount.update((count) => Math.max(0, count - 1));
            this.selectedParticipants = [];
          },
          error: (error) => this.errorHandler.showError(error),
        });
      },
    });
  }

  onBulkDelete(): void {
    if (this.selectedParticipants.length === 0) return;

    const targets = [...this.selectedParticipants];
    const count = targets.length;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${count} participant(s)? This action cannot be undone.`,
      header: 'Confirm Bulk Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        const eventId = this.eventId();
        if (!eventId) return;
        const bibNumbers = targets.map((p) => p.bibNumber);

        // The API accepts at most BULK_DELETE_MAX_LIMIT (25) bib numbers per request,
        // so split into chunks and delete them in parallel. Each chunk is independent:
        // a succeeded chunk removes its rows from the local list; a failed chunk leaves
        // its rows in place. No full backend reload — the local list is updated directly.
        const chunks: string[][] = [];
        for (let i = 0; i < bibNumbers.length; i += BULK_DELETE_MAX_LIMIT) {
          chunks.push(bibNumbers.slice(i, i + BULK_DELETE_MAX_LIMIT));
        }

        // Capture a failing chunk's backend error so it can be surfaced verbatim
        // if nothing ends up deleted, instead of a fabricated frontend message.
        let deleteError: unknown = null;

        forkJoin(
          chunks.map((chunk) =>
            this.participantService.bulkDeleteParticipants(eventId, chunk).pipe(
              map(() => chunk),
              catchError((error) => {
                deleteError = error;
                return of<string[]>([]);
              }),
            ),
          ),
        ).subscribe((deletedChunks) => {
          const removedBibs = deletedChunks.flat();
          const failedCount = bibNumbers.length - removedBibs.length;

          if (removedBibs.length > 0) {
            this.removeParticipantsFromList(removedBibs);
            this.totalCount.update((current) => Math.max(0, current - removedBibs.length));
          }
          this.selectedParticipants = [];

          if (removedBibs.length === 0) {
            this.errorHandler.showError(deleteError);
          } else {
            const message =
              failedCount > 0
                ? `${removedBibs.length} participant(s) deleted, ${failedCount} failed`
                : `${removedBibs.length} participant(s) deleted successfully`;
            this.toast.success(message, 'Success');
          }
        });
      },
    });
  }

  private removeParticipantFromList(bibNumber: string): void {
    this.participants.update((current) => current.filter((p) => p.bibNumber !== bibNumber));
  }

  private removeParticipantsFromList(bibNumbers: string[]): void {
    const set = new Set(bibNumbers);
    this.participants.update((current) => current.filter((p) => !set.has(p.bibNumber)));
  }

  // ---------- Column preferences ----------
  private initializeSelectedColumns(): void {
    const key = STORAGE_KEYS.PARTICIPANT_TABLE_COLUMNS;
    const savedFields = this.storage.getJSON<string[]>(key);
    if (Array.isArray(savedFields)) {
      const savedCols = this.allColumns.filter(
        (col) => savedFields.includes(col.field) || col.required,
      );
      if (savedCols.length > 0) {
        this.selectedCols.set(savedCols);
        return;
      }
    }
    this.selectedCols.set([...this.allColumns]);
  }

  isColumnVisible(field: string): boolean {
    return this.visibleCols().some((col) => col.field === field);
  }

  onColumnSelectionChange(event: MultiSelectChangeEvent): void {
    const newSelection = event.value as TableColumn[];
    const required = this.allColumns.filter((col) => col.required);
    const selectedFields = new Set(newSelection.map((col) => col.field));
    const updatedSelection = [...newSelection];
    for (const req of required) {
      if (!selectedFields.has(req.field)) {
        updatedSelection.push(req);
      }
    }
    this.selectedCols.set(updatedSelection);
    this.storage.setJSON(
      STORAGE_KEYS.PARTICIPANT_TABLE_COLUMNS,
      updatedSelection.map((col) => col.field),
    );
  }

  hasSelection(): boolean {
    return this.selectedParticipants.length > 0;
  }

  // ---------- Goodies display helpers ----------
  getGoodiesCount(goodies: { [key: string]: string } | undefined | null): number {
    if (!goodies || typeof goodies !== 'object') return 0;
    return Object.keys(goodies).length;
  }

  getGoodiesEntries(
    goodies: { [key: string]: string } | undefined | null,
  ): Array<{ key: string; value: string }> {
    if (!goodies || typeof goodies !== 'object') return [];
    return Object.entries(goodies).map(([key, value]) => ({ key, value: String(value) }));
  }

  getDistributedCount(participant: Participant): number {
    const distribution = participant.goodiesDistribution;
    if (!distribution || typeof distribution !== 'object') return 0;
    return Object.keys(distribution).length;
  }

  getGoodiesDistributionSeverity(participant: Participant): ButtonSeverity {
    const total = this.getGoodiesCount(participant.goodies);
    const distributed = this.getDistributedCount(participant);
    if (distributed === 0) return 'warn';
    if (distributed >= total) return 'success';
    return 'info';
  }

  getGoodiesDistributionEntries(
    participant: Participant,
  ): Array<{ key: string; distributed: boolean }> {
    const goodies = participant.goodies;
    const distribution = participant.goodiesDistribution;
    if (!goodies || typeof goodies !== 'object') return [];
    return Object.keys(goodies).map((key) => ({
      key,
      distributed: !!(distribution && distribution[key]),
    }));
  }
}
