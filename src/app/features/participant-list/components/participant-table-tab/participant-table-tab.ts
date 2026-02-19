import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
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
import { MessageModule } from 'primeng/message';
import { PopoverModule } from 'primeng/popover';
import { DividerModule } from 'primeng/divider';
import { Participant, LookupSearchType } from '../../../../core/models/participant.model';
import { Race, Category } from '../../../../core/models/event.model';
import { EventService } from '../../../../core/services/event.service';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { getGenderDisplay, getGenderSeverity } from '../../../../shared/utils/participant.utils';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { LOOKUP_SEARCH_TYPES } from '../../../../shared/constants/participant-columns.constant';
import { TableColumn } from '../../../../shared/models/table-config.model';

@Component({
  selector: 'app-participant-table-tab',
  standalone: true,
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
    MessageModule,
    PopoverModule,
    DividerModule,
    DefaultValuePipe,
  ],
})
export class ParticipantTableTab {
  private eventService = inject(EventService);

  // Inputs
  participants = input.required<Participant[]>();
  totalCount = input<number>(0);
  isLoading = input<boolean>(false);
  hasMore = input<boolean>(true);
  allColumns = input<TableColumn[]>([]);
  isSearchMode = input<boolean>(false);
  storageKey = input<string>(''); // localStorage key for column preferences
  eventId = input<number | undefined>(undefined);

  // Outputs
  loadMore = output<void>();
  viewParticipant = output<Participant>();
  editParticipant = output<Participant>();
  deleteParticipant = output<Participant>();
  bulkDeleteParticipants = output<Participant[]>();
  importClick = output<void>();
  exportClick = output<void>();
  createClick = output<void>();
  searchRequested = output<{ searchType: LookupSearchType; searchValue: string }>();
  searchCleared = output<void>();

  getGenderDisplay = getGenderDisplay;
  getGenderSeverity = getGenderSeverity;

  // Centralized sizing
  buttonSize = BUTTON_SIZE;
  inputSize = FORM_INPUT_SIZE;

  // Lookup search configuration
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

  // Column selection state - using signal for reactive updates
  selectedCols = signal<TableColumn[]>([]);

  // Computed: get current search placeholder
  searchPlaceholder = computed(() => {
    const searchType = this.selectedSearchType();
    const option = this.lookupSearchTypes.find((t) => t.value === searchType);
    return option?.placeholder || 'Enter search value';
  });

  // Computed: visible columns including required columns
  visibleCols = computed(() => {
    const selected = this.selectedCols();
    const all = this.allColumns();
    const required = all.filter((col) => col.required);
    const selectedFields = new Set(selected.map((col) => col.field));
    const requiredFields = new Set(required.map((col) => col.field));

    // Combine required and selected, preserving order from allColumns
    const visible = all.filter(
      (col) => requiredFields.has(col.field) || selectedFields.has(col.field),
    );

    return visible;
  });

  // Computed: available columns for multiselect (with required columns disabled)
  availableColumns = computed(() => {
    return this.allColumns().map((col) => ({
      ...col,
      disabled: col.required, // Disable required columns so they can't be removed
    }));
  });

  // Selection state (using regular variable for PrimeNG two-way binding)
  selectedParticipants: Participant[] = [];

  // Skeleton rows for initial loading state
  skeletonRows = Array(5).fill({});

  // Computed: true when loading and no data yet (initial load)
  isInitialLoading = computed(() => this.isLoading() && this.participants().length === 0);

  // Computed: true when loading but already have data (load more)
  isLoadingMore = computed(() => this.isLoading() && this.participants().length > 0);

  constructor() {
    // Load races/categories when eventId changes
    effect(() => {
      const eventId = this.eventId();
      if (eventId) {
        this.loadEventData(eventId);
      } else {
        this.races.set([]);
        this.categories.set([]);
      }
    });

    // Auto-initialize columns from localStorage or defaults
    effect(() => {
      const cols = this.allColumns();
      const key = this.storageKey();

      if (cols.length > 0 && this.selectedCols().length === 0) {
        // Try to load from localStorage if key is provided
        if (key) {
          try {
            const saved = localStorage.getItem(key);
            if (saved) {
              const savedFields: string[] = JSON.parse(saved);
              // Load saved columns + ensure required columns are included
              const savedCols = cols.filter(
                (col) => savedFields.includes(col.field) || col.required,
              );
              if (savedCols.length > 0) {
                this.selectedCols.set(savedCols);
                return;
              }
            }
          } catch (e) {
            console.warn('Failed to load column preferences from localStorage', e);
          }
        }

        // Default: select all columns
        this.selectedCols.set([...cols]);
      }
    });
  }

  // Method: true when at least one participant is selected
  hasSelection(): boolean {
    return this.selectedParticipants.length > 0;
  }

  isColumnVisible(field: string): boolean {
    return this.visibleCols().some((col) => col.field === field);
  }

  onColumnSelectionChange(event: MultiSelectChangeEvent): void {
    const newSelection = event.value as TableColumn[];

    // Ensure required columns are always included
    const required = this.allColumns().filter((col) => col.required);
    const selectedFields = new Set(newSelection.map((col) => col.field));

    // Add required columns if not already selected
    const updatedSelection = [...newSelection];
    for (const req of required) {
      if (!selectedFields.has(req.field)) {
        updatedSelection.push(req);
      }
    }

    // Update the signal
    this.selectedCols.set(updatedSelection);

    // Auto-save to localStorage if key is provided
    const key = this.storageKey();
    if (key) {
      try {
        const fields = updatedSelection.map((col) => col.field);
        localStorage.setItem(key, JSON.stringify(fields));
      } catch (e) {
        console.warn('Failed to save column preferences to localStorage', e);
      }
    }
  }

  onLoadMore(): void {
    this.loadMore.emit();
  }

  onView(participant: Participant): void {
    this.viewParticipant.emit(participant);
  }

  onEdit(participant: Participant): void {
    this.editParticipant.emit(participant);
  }

  onDelete(participant: Participant): void {
    this.deleteParticipant.emit(participant);
  }

  onBulkDelete(): void {
    if (this.selectedParticipants.length > 0) {
      this.bulkDeleteParticipants.emit([...this.selectedParticipants]);
    }
  }

  clearSelection(): void {
    this.selectedParticipants = [];
  }

  onImport(): void {
    this.importClick.emit();
  }

  onExport(): void {
    this.exportClick.emit();
  }

  onCreate(): void {
    this.createClick.emit();
  }

  onSearchTypeChange(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
  }

  performSearch(): void {
    const isDropdown = this.isDropdownSearch();
    const value = isDropdown ? this.dropdownSelectedItem() : this.searchValue().trim();
    if (!value || value.length < 2) return;
    this.searchRequested.emit({
      searchType: this.selectedSearchType(),
      searchValue: value,
    });
  }

  clearSearch(): void {
    this.searchValue.set('');
    this.dropdownSelectedItem.set('');
    this.selectedSearchType.set('BIB');
    this.searchCleared.emit();
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

  // Goodies helper methods
  getGoodiesCount(goodies: any): number {
    if (!goodies || typeof goodies !== 'object') return 0;
    return Object.keys(goodies).length;
  }

  getGoodiesEntries(goodies: any): Array<{ key: string; value: string }> {
    if (!goodies || typeof goodies !== 'object') return [];
    return Object.entries(goodies).map(([key, value]) => ({
      key: key,
      value: String(value),
    }));
  }

  formatGoodiesKey(key: string): string {
    // Convert "T-Shirt size" or "cap-size" to "T-Shirt Size" or "Cap Size"
    return key
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
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
