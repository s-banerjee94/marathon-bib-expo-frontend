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
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { ParticipantPendingGoodies } from '../../../../core/models/distribution.model';
import { DistributionService } from '../../../../core/services/distribution.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { BUTTON_SIZE, PAGINATION_LIMIT } from '../../../../shared/constants/form.constants';

@Component({
  selector: 'app-pending-goodies-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    MessageModule,
    DefaultValuePipe,
  ],
  templateUrl: './pending-goodies-tab.html',
})
export class PendingGoodiesTab implements OnChanges {
  private distributionService = inject(DistributionService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() eventId: number | undefined;

  @Output() distributeGoodies = new EventEmitter<ParticipantPendingGoodies>();

  buttonSize = BUTTON_SIZE;
  skeletonRows = Array(5).fill({});

  participants = signal<ParticipantPendingGoodies[]>([]);
  loadedCount = signal(0);
  /** True only on the very first load (no data yet) */
  loading = signal(false);
  /** True when silently refreshing in the background (data still visible) */
  refreshing = signal(false);
  error = signal<string | null>(null);
  hasMore = signal(false);
  lastEvaluatedKey = signal<string | undefined>(undefined);
  loaded = signal(false);

  isInitialLoading = computed(() => this.loading() && this.participants().length === 0);
  isLoadingMore = computed(() => this.loading() && this.participants().length > 0);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId']) {
      this.resetAndLoad();
    }
  }

  /**
   * Called by parent after a distribution action, or by the Refresh button.
   * Keeps existing rows visible while fetching — replaces data when done.
   */
  reload(): void {
    const eventId = this.eventId;
    if (!eventId || this.refreshing()) return;

    const limit = Math.max(this.participants().length, PAGINATION_LIMIT);
    this.refreshing.set(true);
    this.error.set(null);

    this.distributionService.getPendingGoodies(eventId, limit).subscribe({
      next: (response) => {
        this.participants.set(response.participants);
        this.loadedCount.set(response.participants.length);
        this.hasMore.set(response.hasMore);
        this.lastEvaluatedKey.set(response.lastEvaluatedKey);
        this.loaded.set(true);
        this.refreshing.set(false);
      },
      error: (err) => {
        this.refreshing.set(false);
        this.error.set('Failed to refresh. Please try again.');
        this.errorHandler.showError(err, 'Failed to load pending goodies');
      },
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loading() || this.refreshing()) return;
    this.doLoad();
  }

  private resetAndLoad(): void {
    this.participants.set([]);
    this.loadedCount.set(0);
    this.lastEvaluatedKey.set(undefined);
    this.hasMore.set(false);
    this.error.set(null);
    this.loaded.set(false);
    if (this.eventId) this.doLoad();
  }

  /** Used for initial load and load-more (append mode) */
  private doLoad(limit = PAGINATION_LIMIT): void {
    const eventId = this.eventId;
    if (!eventId) return;

    this.loading.set(true);
    this.distributionService.getPendingGoodies(eventId, limit, this.lastEvaluatedKey()).subscribe({
      next: (response) => {
        this.participants.update((prev) => [...prev, ...response.participants]);
        this.loadedCount.set(this.participants().length);
        this.hasMore.set(response.hasMore);
        this.lastEvaluatedKey.set(response.lastEvaluatedKey);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Failed to load pending goodies. Please try again.');
        this.errorHandler.showError(err, 'Failed to load pending goodies');
      },
    });
  }

  formatGoodiesKey(key: string): string {
    return key
      .split(/[-_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
