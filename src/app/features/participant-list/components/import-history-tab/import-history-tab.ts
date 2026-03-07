import { Component, input, output } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ImportErrorItem } from '../../../../core/models/participant.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';

@Component({
  selector: 'app-import-history-tab',
  standalone: true,
  templateUrl: './import-history-tab.html',
  imports: [TableModule, TagModule, ButtonModule, DefaultValuePipe],
})
export class ImportHistoryTab {
  errors = input<ImportErrorItem[]>([]);
  isLoading = input<boolean>(false);
  hasMore = input<boolean>(false);

  loadMore = output<void>();

  onLoadMore(): void {
    this.loadMore.emit();
  }
}
