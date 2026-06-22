import { CommonModule } from '@angular/common';
import { Component, contentChild, input, model, output, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableLazyLoadEvent } from 'primeng/table';
import { FORM_INPUT_SIZE } from '../../../constants/form.constants';
import { TableColumn } from '../../../models/table-config.model';
import { EmptyIllustrationName } from '../../../illustrations/empty-illustration';
import { ListSearch } from '../list-search/list-search';
import { ListFilterPanel } from '../list-filter-panel/list-filter-panel';
import { MobileCardList } from '../mobile-card-list/mobile-card-list';

/**
 * One-stop page shell for paginated list views.
 *
 * Owns the layout that every list shares: header, search bar, action area,
 * filter drawer (mobile) / inline filter row (desktop), column selector, and
 * the desktop-table-vs-mobile-card-list branch. Per-list specifics come in
 * through named templates and content slots:
 *
 *  - `#actions`     — extra buttons next to the search bar (e.g. "Create")
 *  - `#filters`     — filter inputs rendered inline on desktop, in a dialog on mobile
 *  - `#desktopBody` — desktop content, typically a <p-table>
 *  - `#mobileCard`  — template for one mobile card; receives `let-item let-index="index"`
 *
 * Search, pagination, and column-selector state stay on the parent (which
 * extends BaseTableComponent); this shell wires those signals into the right
 * child components.
 */
@Component({
  selector: 'app-list-shell',
  imports: [
    CommonModule,
    FormsModule,
    MultiSelectModule,
    ListSearch,
    ListFilterPanel,
    MobileCardList,
  ],
  templateUrl: './list-shell.html',
  styleUrl: './list-shell.css',
})
export class ListShell<T = unknown> {
  heading = input<string>('');
  subtitle = input<string>('');

  // Viewport
  isMobile = input<boolean>(false);

  // Search
  isLoading = input<boolean>(false);
  searchTerm = input<string>('');
  searchPlaceholder = input<string>('Search (min 2 chars)...');
  /** Desktop width cap for the search box (Tailwind class). Mobile is always full-width. */
  searchMaxWidthClass = input<string>('sm:max-w-md');
  searchChange = output<string>();
  searchClear = output<void>();

  // Filters
  activeFilterCount = input<number>(0);
  /** Mobile-only: render the Filters button on the search row instead of its own row below. */
  inlineMobileFilters = input<boolean>(false);

  // Column selector — hidden on mobile via the template
  showColumnSelector = input<boolean>(true);
  columns = input<TableColumn[]>([]);
  selectedColumns = model<TableColumn[]>([]);
  columnSelectionChange = output<void>();

  // Mobile card list pagination + empty-state forwarding
  items = input<T[]>([]);
  totalRecords = input<number>(0);
  currentPage = input<number>(0);
  pageSize = input<number>(5);
  rowsPerPageOptions = input<number[]>([5, 10, 20, 50]);
  emptyIcon = input<string>('pi pi-inbox');
  emptyIllustration = input<EmptyIllustrationName>('no-data');
  emptyMessage = input<string>('No results found');
  emptyHint = input<string>('Try adjusting your search or filters');
  pageChange = output<TableLazyLoadEvent>();

  // Projected templates (parent declares <ng-template #name> inside this component)
  protected actionsTpl = contentChild<TemplateRef<unknown>>('actions');
  protected filtersTpl = contentChild<TemplateRef<unknown>>('filters');
  protected desktopTpl = contentChild<TemplateRef<unknown>>('desktopBody');
  protected mobileCardTpl =
    contentChild<TemplateRef<{ $implicit: T; index: number }>>('mobileCard');

  readonly inputSize = FORM_INPUT_SIZE;
}
