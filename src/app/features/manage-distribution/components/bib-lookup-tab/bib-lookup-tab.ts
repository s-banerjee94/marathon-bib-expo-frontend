import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
  EventEmitter,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule, ButtonSeverity } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { PopoverModule } from 'primeng/popover';
import { MessageModule } from 'primeng/message';
import { Participant, LookupSearchType } from '../../../../core/models/participant.model';
import { Race, Category } from '../../../../core/models/event.model';
import { ParticipantService } from '../../../../core/services/participant.service';
import { EventService } from '../../../../core/services/event.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { LOOKUP_SEARCH_TYPES } from '../../../../shared/constants/participant-columns.constant';
import {
  BUTTON_SIZE,
  FORM_INPUT_SIZE,
  PAGINATION_LIMIT,
} from '../../../../shared/constants/form.constants';

@Component({
  selector: 'app-bib-lookup-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    SkeletonModule,
    TableModule,
    SelectModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    PopoverModule,
    MessageModule,
    DefaultValuePipe,
  ],
  templateUrl: './bib-lookup-tab.html',
})
export class BibLookupTab implements OnChanges {
  private participantService = inject(ParticipantService);
  private eventService = inject(EventService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() eventId: number | undefined;
  @Input() canUndoBib = false;

  @Output() collectBib = new EventEmitter<Participant>();
  @Output() distributeGoodies = new EventEmitter<Participant>();
  @Output() undoBib = new EventEmitter<Participant>();

  // Sizing
  buttonSize = BUTTON_SIZE;
  inputSize = FORM_INPUT_SIZE;

  // Search state
  lookupSearchTypes = LOOKUP_SEARCH_TYPES;
  selectedSearchType = signal<LookupSearchType>('BIB');
  searchValue = signal<string>('');
  dropdownSelectedItem = signal<string>('');

  // Race / Category dropdown data
  races = signal<Race[]>([]);
  categories = signal<Category[]>([]);
  isRacesLoading = signal(false);

  // Computed: true when current search type uses a dropdown instead of text input
  isDropdownSearch = computed(
    () => this.selectedSearchType() === 'RACE' || this.selectedSearchType() === 'CATEGORY',
  );

  // Results state
  results = signal<Participant[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  lastEvaluatedKey = signal<string | undefined>(undefined);
  isSearched = signal(false);

  skeletonRows = Array(5).fill({});

  isInitialLoading = computed(() => this.loading() && this.results().length === 0);
  isLoadingMore = computed(() => this.loading() && this.results().length > 0);

  searchPlaceholder = computed(() => {
    const option = this.lookupSearchTypes.find((t) => t.value === this.selectedSearchType());
    return option?.placeholder || 'Enter search value';
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId']) {
      if (!changes['eventId'].firstChange) {
        this.resetState();
      }
      if (this.eventId) {
        this.loadEventData(this.eventId);
      } else {
        this.races.set([]);
        this.categories.set([]);
      }
    }
  }

  onSearchTypeChange(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
  }

  performSearch(): void {
    const isDropdown = this.isDropdownSearch();
    const value = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();
    if (!value || value.length < 2 || !this.eventId) return;

    this.results.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.error.set(null);
    this.isSearched.set(true);
    this.doSearch();
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading()) return;
    this.doSearch();
  }

  /** Called by parent after a distribution action to refresh results */
  reload(): void {
    if (!this.isSearched() || !this.eventId) return;
    const currentResults = this.results();
    this.results.set([]);
    this.lastEvaluatedKey.set(undefined);
    this.error.set(null);
    this.doSearch(
      currentResults.length > PAGINATION_LIMIT ? PAGINATION_LIMIT * 2 : PAGINATION_LIMIT,
    );
  }

  private doSearch(limit = PAGINATION_LIMIT): void {
    const eventId = this.eventId;
    if (!eventId) return;

    const isDropdown = this.isDropdownSearch();
    const searchValue = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();

    this.loading.set(true);
    this.participantService
      .lookupParticipants({
        eventId,
        searchType: this.selectedSearchType(),
        searchValue,
        limit,
        lastEvaluatedKey: this.lastEvaluatedKey(),
      })
      .subscribe({
        next: (response) => {
          this.results.update((prev) => [...prev, ...response.participants]);
          this.hasMore.set(response.hasMore);
          this.lastEvaluatedKey.set(response.lastEvaluatedKey);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorHandler.showError(err, 'Search failed');
          this.error.set('Search failed. Please try again.');
        },
      });
  }

  clearSearch(): void {
    this.resetState();
  }

  private resetState(): void {
    this.results.set([]);
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.selectedSearchType.set('BIB');
    this.lastEvaluatedKey.set(undefined);
    this.hasMore.set(false);
    this.error.set(null);
    this.isSearched.set(false);
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
      error: () => {
        this.isRacesLoading.set(false);
      },
    });
  }

  // BIB status helpers
  getBibStatus(participant: Participant): boolean {
    return !!participant.bibCollectedAt;
  }

  // Goodies helpers
  hasPendingGoodies(participant: Participant): boolean {
    if (!participant.goodies) return false;
    const keys = Object.keys(participant.goodies);
    if (keys.length === 0) return false;
    return keys.some((k) => !participant.goodiesDistribution?.[k]);
  }

  getGoodiesCount(goodies: { [key: string]: string } | undefined): number {
    if (!goodies) return 0;
    return Object.keys(goodies).length;
  }

  getDistributedCount(participant: Participant): number {
    const dist = participant.goodiesDistribution;
    if (!dist) return 0;
    return Object.keys(dist).length;
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
  ): Array<{ key: string; value: string; distributed: boolean }> {
    const goodies = participant.goodies;
    if (!goodies) return [];
    return Object.keys(goodies).map((key) => ({
      key,
      value: goodies[key],
      distributed: !!participant.goodiesDistribution?.[key],
    }));
  }

  formatGoodiesKey(key: string): string {
    return key
      .split(/[-_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
