import { Directive, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TableColumn, TableFilterPreferences } from '../models/table-config.model';
import { PageableParams, PageableResponse } from '../../core/models/api.model';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { FORM_INPUT_SIZE } from '../constants/form.constants';

/**
 * Base table component that provides common table functionality
 * Extend this class in your list components to avoid code duplication
 *
 * @template T - The entity type (e.g., User, Organization)
 * @template F - The filter preferences type
 */
@Directive()
export abstract class BaseTableComponent<T, F extends TableFilterPreferences>
  implements OnInit, OnDestroy
{
  // Data signals
  entities = signal<T[]>([]);
  isLoading = signal(false);
  currentPage = signal(0);
  pageSize = signal(5);
  totalRecords = signal(0);
  searchTerm = signal('');
  // Filter signals (to be extended by subclasses if needed)
  filterEnabled = signal(true);
  filterSort = signal<string[]>([]);
  // Sort signals
  selectedSort = signal<string | null>(null);
  // Column signals
  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;
  protected dialogService = inject(DialogService);
  protected messageService = inject(MessageService);
  protected errorHandler = inject(ErrorHandlerService);
  protected dialogRef: DynamicDialogRef | null = null;
  protected searchSubject = new Subject<string>();
  // Abstract properties - must be implemented by subclasses
  protected abstract columnPreferenceKey: string;
  protected abstract filterPreferenceKey: string;
  protected abstract allColumns: TableColumn[];
  private preferenceSaveSubject = new Subject<void>();

  constructor() {
    // Debounce preference saves to avoid performance issues
    this.preferenceSaveSubject.pipe(debounceTime(300)).subscribe(() => {
      this.saveColumnPreferences(this.selectedCols());
      this.saveFilterPreferences(this.getCurrentFilterPreferences());
    });
  }

  get visibleCols(): TableColumn[] {
    const selected = this.selectedCols();
    const required = this.getRequiredColumns();

    // Always include required columns + selected columns (without duplicates)
    const result = [...required];

    selected.forEach((col) => {
      if (!required.find((r) => r.field === col.field)) {
        result.push(col);
      }
    });

    return result;
  }

  displayData(): T[] {
    if (this.isLoading()) {
      // Return dummy skeleton data with the same number of rows as pageSize
      return Array(this.pageSize()).fill({} as T);
    }
    return this.entities();
  }

  ngOnInit(): void {
    // Set up debounced search with minimum 2 characters
    this.searchSubject.pipe(debounceTime(500), distinctUntilChanged()).subscribe((searchValue) => {
      this.searchTerm.set(searchValue);

      // Only search if empty or at least 2 characters
      if (searchValue.trim().length === 0 || searchValue.trim().length >= 2) {
        this.currentPage.set(0);
        this.loadData();
      }
    });

    // Data loading is handled by PrimeNG table's lazy load event (onLazyLoad)
    // No need to call loadData() here to avoid duplicate backend calls
  }

  onPageChange(event: TableLazyLoadEvent): void {
    this.currentPage.set(Math.floor((event.first ?? 0) / (event.rows ?? 10)));
    this.pageSize.set(event.rows ?? 10);
    this.loadData();
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.currentPage.set(0);
    this.loadData();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.preferenceSaveSubject.next();
    this.loadData();
  }

  onSortChange(value: string | null): void {
    this.selectedSort.set(value);
    if (value) {
      this.filterSort.set([value]);
    } else {
      this.filterSort.set([]);
    }
    this.currentPage.set(0);
    this.preferenceSaveSubject.next();
    this.loadData();
  }

  onColumnSelectionChange(): void {
    this.preferenceSaveSubject.next();
  }

  getCellValue(entity: T, fieldName: string): unknown {
    return (entity as unknown as Record<string, unknown>)[fieldName];
  }

  getDateValue(entity: T, fieldName: string): string | Date | null {
    const value = this.getCellValue(entity, fieldName);
    return value as string | Date | null;
  }

  getSortIcon(fieldName: string): string {
    const currentSort = this.selectedSort();
    if (!currentSort) return '';

    const [sortField, sortDirection] = currentSort.split(',');
    if (sortField !== fieldName) return '';

    return sortDirection === 'asc' ? 'pi pi-sort-up' : 'pi pi-sort-down';
  }

  isSorted(fieldName: string): boolean {
    const currentSort = this.selectedSort();
    if (!currentSort) return false;

    const [sortField] = currentSort.split(',');
    return sortField === fieldName;
  }

  ngOnDestroy(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
    this.searchSubject.complete();
    this.preferenceSaveSubject.complete();
  }

  protected initializeColumns(): void {
    // Initialize columns (call this from subclass constructor)
    this.cols.set(this.allColumns);
    this.selectedCols.set(this.loadColumnPreferences());

    // Load filter preferences after subclass signals are initialized
    const filterPrefs = this.loadFilterPreferences();
    this.applyFilterPreferences(filterPrefs);

    // Set selectedSort from loaded preferences
    if (filterPrefs.sort && filterPrefs.sort.length > 0) {
      this.selectedSort.set(filterPrefs.sort[0]);
    }
  }

  protected getRequiredColumns(): TableColumn[] {
    return this.allColumns.filter((col) => col.required);
  }

  protected loadColumnPreferences(): TableColumn[] {
    try {
      const savedPrefs = localStorage.getItem(this.columnPreferenceKey);
      if (savedPrefs) {
        const savedFields = JSON.parse(savedPrefs) as string[];
        // Map saved field names back to column objects
        const savedColumns = savedFields
          .map((field) => this.allColumns.find((col) => col.field === field))
          .filter((col): col is TableColumn => col !== undefined);

        // Return saved columns if any were found, otherwise return required columns
        return savedColumns.length > 0 ? savedColumns : this.getRequiredColumns();
      }
    } catch (error) {
      console.error('Failed to load column preferences:', error);
    }
    // Default to required columns
    return this.getRequiredColumns();
  }

  protected saveColumnPreferences(columns: TableColumn[]): void {
    try {
      // Save only the field names to keep localStorage lean
      const fieldNames = columns.map((col) => col.field);
      localStorage.setItem(this.columnPreferenceKey, JSON.stringify(fieldNames));
    } catch (error) {
      console.error('Failed to save column preferences:', error);
    }
  }

  protected loadFilterPreferences(): F {
    try {
      const savedPrefs = localStorage.getItem(this.filterPreferenceKey);
      if (savedPrefs) {
        return JSON.parse(savedPrefs) as F;
      }
    } catch (error) {
      console.error('Failed to load filter preferences:', error);
    }
    // Default filter preferences
    return this.getDefaultFilterPreferences();
  }

  protected saveFilterPreferences(prefs: F): void {
    try {
      localStorage.setItem(this.filterPreferenceKey, JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to save filter preferences:', error);
    }
  }

  protected buildPageableParams(): PageableParams {
    const params: PageableParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      enabled: this.filterEnabled(),
    };

    // Add search term if at least 2 characters
    const searchValue = this.searchTerm().trim();
    if (searchValue.length >= 2) {
      params.search = searchValue;
    }

    // Add sort if present
    const sortValue = this.filterSort();
    if (sortValue.length > 0) {
      params.sort = sortValue;
    }

    return params;
  }

  protected handleLoadSuccess(response: PageableResponse<T>): void {
    this.entities.set(response.content);
    this.totalRecords.set(response.totalElements);
    this.isLoading.set(false);
  }

  protected handleLoadError(error: unknown): void {
    this.isLoading.set(false);
    this.errorHandler.showError(error, 'Error loading data');
  }

  protected openDialog<C>(component: C, header: string, data: unknown): DynamicDialogRef | null {
    this.dialogRef = this.dialogService.open(component as never, {
      header,
      width: '45vw',
      modal: true,
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      breakpoints: {
        '960px': '95vw',
        '640px': '100vw',
      },
      data,
    });

    return this.dialogRef;
  }

  // Abstract methods - must be implemented by subclasses
  protected abstract loadData(): void;
  protected abstract getDefaultFilterPreferences(): F;
  protected abstract getCurrentFilterPreferences(): F;
  protected abstract applyFilterPreferences(prefs: F): void;
}
