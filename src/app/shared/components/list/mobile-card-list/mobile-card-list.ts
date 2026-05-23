import { CommonModule } from '@angular/common';
import { Component, contentChild, input, output, TemplateRef } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent } from 'primeng/table';

/**
 * Card-style replacement for <p-table> on mobile.
 *
 * The parent supplies one <ng-template #cardTemplate let-item let-index="index">
 * that renders an individual card body. This component handles skeleton loading,
 * empty state, and pagination.
 *
 * pageChange emits a TableLazyLoadEvent-shaped object so callers can reuse the
 * same handler their <p-table> already uses (BaseTableComponent.onPageChange).
 */
@Component({
  selector: 'app-mobile-card-list',
  imports: [CommonModule, ButtonModule, CardModule, PaginatorModule, SkeletonModule],
  templateUrl: './mobile-card-list.html',
  styleUrl: './mobile-card-list.css',
})
export class MobileCardList<T = unknown> {
  items = input<T[]>([]);
  totalRecords = input<number>(0);
  currentPage = input<number>(0);
  pageSize = input<number>(5);
  isLoading = input<boolean>(false);
  rowsPerPageOptions = input<number[]>([5, 10, 20, 50]);
  emptyIcon = input<string>('pi pi-inbox');
  emptyMessage = input<string>('No results found');
  emptyHint = input<string>('Try adjusting your search or filters');

  pageChange = output<TableLazyLoadEvent>();

  protected cardTemplate =
    contentChild<TemplateRef<{ $implicit: T; index: number }>>('cardTemplate');

  protected get first(): number {
    return this.currentPage() * this.pageSize();
  }

  protected get skeletonRows(): unknown[] {
    return Array(this.pageSize()).fill(null);
  }

  onPaginatorChange(event: PaginatorState): void {
    this.pageChange.emit({
      first: event.first ?? 0,
      rows: event.rows ?? this.pageSize(),
    });
  }
}
