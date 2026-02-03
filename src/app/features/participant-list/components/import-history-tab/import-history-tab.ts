import { Component, computed, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ImportErrorItem, ImportHistoryItem } from '../../../../core/models/participant.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { getImportStatusSeverity } from '../../../../shared/utils/participant.utils';

@Component({
  selector: 'app-import-history-tab',
  standalone: true,
  templateUrl: './import-history-tab.html',
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    TableModule,
    TagModule,
    ButtonModule,
    SelectModule,
    DefaultValuePipe,
  ],
})
export class ImportHistoryTab {
  importHistory = input.required<ImportHistoryItem[]>();
  isLoadingHistory = input<boolean>(false);
  selectedImportId = input<string | undefined>(undefined);
  importErrors = input<ImportErrorItem[]>([]);
  isLoadingErrors = input<boolean>(false);
  hasMoreErrors = input<boolean>(true);

  importSelect = output<string | undefined>();
  loadMoreErrors = output<void>();

  getImportStatusSeverity = getImportStatusSeverity;

  selectedImport = computed(() => {
    const importId = this.selectedImportId();
    if (!importId) return null;
    return this.importHistory().find((imp) => imp.importId === importId) || null;
  });

  onImportSelect(importId: string | undefined): void {
    this.importSelect.emit(importId);
  }

  onLoadMoreErrors(): void {
    this.loadMoreErrors.emit();
  }
}
