import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { Participant } from '../../../../core/models/participant.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { getGenderDisplay, getGenderSeverity } from '../../../../shared/utils/participant.utils';

@Component({
  selector: 'app-participant-table-tab',
  standalone: true,
  templateUrl: './participant-table-tab.html',
  imports: [
    CommonModule,
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
    DefaultValuePipe,
  ],
})
export class ParticipantTableTab {
  participants = input.required<Participant[]>();
  isLoading = input<boolean>(false);
  hasMore = input<boolean>(true);
  visibleColumns = input<string[]>([]);

  loadMore = output<void>();
  viewParticipant = output<Participant>();
  editParticipant = output<Participant>();
  deleteParticipant = output<Participant>();
  importClick = output<void>();
  exportClick = output<void>();
  createClick = output<void>();

  getGenderDisplay = getGenderDisplay;
  getGenderSeverity = getGenderSeverity;

  // Skeleton rows for initial loading state
  skeletonRows = Array(5).fill({});

  // Computed: true when loading and no data yet (initial load)
  isInitialLoading = computed(() => this.isLoading() && this.participants().length === 0);

  // Computed: true when loading but already have data (load more)
  isLoadingMore = computed(() => this.isLoading() && this.participants().length > 0);

  isColumnVisible(field: string): boolean {
    return this.visibleColumns().includes(field);
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

  onImport(): void {
    this.importClick.emit();
  }

  onExport(): void {
    this.exportClick.emit();
  }

  onCreate(): void {
    this.createClick.emit();
  }
}
