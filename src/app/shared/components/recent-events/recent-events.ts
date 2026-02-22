import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Event, EventStatus } from '../../../core/models/event.model';

@Component({
  selector: 'app-recent-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, CardModule, SkeletonModule, TableModule, TagModule],
  templateUrl: './recent-events.html',
})
export class RecentEvents {
  events = input<Event[]>([]);
  isLoading = input<boolean>(false);
  viewAll = output<void>();

  getStatusSeverity(
    status: EventStatus,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case EventStatus.PUBLISHED:
        return 'success';
      case EventStatus.DRAFT:
        return 'info';
      case EventStatus.CANCELLED:
        return 'danger';
      case EventStatus.COMPLETED:
        return 'secondary';
      default:
        return 'secondary';
    }
  }
}
