import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { Category } from '../../../core/models/category.model';
import { Race } from '../../../core/models/race.model';
import { CategoryService } from '../../../core/services/category.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { CategoryForm } from '../category-form/category-form';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../../../core/models/category.model';
import { TableColumn } from '../../../shared/models/table-config.model';
import { CATEGORY_COLUMNS } from '../../../shared/constants/category-columns.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  initializeColumnPreferences,
  saveColumnPreferences,
} from '../../../shared/utils/column.utils';

const DEFAULT_CATEGORY_FIELDS = ['id', 'categoryName', 'createdBy', 'createdAt'];

@Component({
  selector: 'app-category-section',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    MultiSelectModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ConfirmPopupModule,
  ],
  providers: [DialogService, ConfirmationService, MessageService],
  templateUrl: './category-section.html',
  styleUrl: './category-section.css',
})
export class CategorySection {
  eventId = input.required<number>();
  races = input.required<Race[]>();
  selectedRaceFromParent = input<Race | null>(null);

  private categoryService = inject(CategoryService);
  private errorHandler = inject(ErrorHandlerService);
  private dialogService = inject(DialogService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  categories = signal<Category[]>([]);
  isLoading = signal(false);
  selectedRace = signal<Race | null>(null);

  cols = signal<TableColumn[]>([]);
  selectedCols = signal<TableColumn[]>([]);
  readonly inputSize = FORM_INPUT_SIZE;

  private dialogRef: DynamicDialogRef | null = null;

  canLoadCategories = computed(() => !!this.selectedRace());

  constructor() {
    initializeColumnPreferences(
      CATEGORY_COLUMNS,
      DEFAULT_CATEGORY_FIELDS,
      STORAGE_KEYS.CATEGORY_TABLE_COLUMNS,
      this.cols,
      this.selectedCols,
    );

    effect(
      () => {
        const raceFromParent = this.selectedRaceFromParent();
        if (raceFromParent) {
          this.selectedRace.set(raceFromParent);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        if (this.canLoadCategories()) {
          this.loadCategories();
        }
      },
      { allowSignalWrites: true },
    );
  }

  onColumnSelectionChange(): void {
    saveColumnPreferences(this.selectedCols, STORAGE_KEYS.CATEGORY_TABLE_COLUMNS);
  }

  onRaceChange(race: Race): void {
    this.selectedRace.set(race);
  }

  loadCategories(): void {
    const race = this.selectedRace();
    if (!race) return;

    this.isLoading.set(true);
    this.categoryService.getCategoriesByRaceId(this.eventId(), race.id).subscribe({
      next: (categories: Category[]) => {
        this.categories.set(categories);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorHandler.showError(error, 'Failed to load categories');
        this.isLoading.set(false);
      },
    });
  }

  onCreate(): void {
    const race = this.selectedRace();
    if (!race) return;

    this.dialogRef = this.dialogService.open(CategoryForm, {
      header: 'Create Category',
      width: '500px',
      data: { category: null },
    });

    this.dialogRef?.onClose.subscribe((result: unknown) => {
      if (result) {
        this.isLoading.set(true);
        const request = result as CreateCategoryRequest;
        this.categoryService.createCategory(this.eventId(), race.id, request).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Category created successfully',
            });
            this.loadCategories();
          },
          error: (error: unknown) => {
            this.errorHandler.showError(error, 'Failed to create category');
            this.isLoading.set(false);
          },
        });
      }
    });
  }

  onEdit(category: Category): void {
    this.dialogRef = this.dialogService.open(CategoryForm, {
      header: 'Edit Category',
      width: '500px',
      data: { category },
    });

    this.dialogRef?.onClose.subscribe((result: unknown) => {
      if (result) {
        this.isLoading.set(true);
        const request = result as UpdateCategoryRequest;
        this.categoryService
          .updateCategory(this.eventId(), category.raceId, category.id, request)
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Category updated successfully',
              });
              this.loadCategories();
            },
            error: (error: unknown) => {
              this.errorHandler.showError(error, 'Failed to update category');
              this.isLoading.set(false);
            },
          });
      }
    });
  }

  onDelete(category: Category, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to delete "${category.categoryName}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-sm',
      accept: () => {
        this.isLoading.set(true);
        this.categoryService
          .deleteCategory(this.eventId(), category.raceId, category.id)
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Category deleted successfully',
              });
              this.loadCategories();
            },
            error: (error: unknown) => {
              this.errorHandler.showError(error, 'Failed to delete category');
              this.isLoading.set(false);
            },
          });
      },
    });
  }
}
