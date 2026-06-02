import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ImportErrorItem } from '../../../../core/models/participant.model';
import { ParticipantService } from '../../../../core/services/participant.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { LabelizePipe } from '../../../../shared/pipes/labelize-pipe';
import { ParticipantListState } from '../participant-list-state.service';

const IMPORT_ERRORS_PAGE_SIZE = 50;

@Component({
  selector: 'app-import-history-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-history-tab.html',
  imports: [TableModule, TagModule, ButtonModule, SkeletonModule, LabelizePipe],
})
export class ImportHistoryTab {
  private participantService = inject(ParticipantService);
  private errorHandler = inject(ErrorHandlerService);
  private listState = inject(ParticipantListState);

  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  errors = signal<ImportErrorItem[]>([]);
  isLoading = signal(false);
  hasMore = signal(false);
  private lastEvaluatedKey?: string;

  // True only on the very first load (no data yet) — drives the skeleton rows.
  isInitialLoading = computed(() => this.isLoading() && this.errors().length === 0);
  // True while appending another page — drives the small "load more" indicator.
  isLoadingMore = computed(() => this.isLoading() && this.errors().length > 0);

  // Placeholder rows rendered as skeletons during the initial load.
  skeletonRows = Array(5).fill({});

  constructor() {
    // Effect 1: react to eventId changes — fresh load.
    effect(
      () => {
        const id = this.eventId();
        untracked(() => {
          if (id) {
            this.resetAndLoad();
          } else {
            this.errors.set([]);
            this.hasMore.set(false);
            this.lastEvaluatedKey = undefined;
          }
        });
      },
      { allowSignalWrites: true },
    );

    // Effect 2: react to cross-tab reload triggers (e.g., after import completion).
    effect(
      () => {
        if (this.listState.reloadTrigger() > 0) {
          untracked(() => this.resetAndLoad());
        }
      },
      { allowSignalWrites: true },
    );
  }

  private resetAndLoad(): void {
    this.errors.set([]);
    this.hasMore.set(false);
    this.lastEvaluatedKey = undefined;
    this.loadErrors();
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoading()) return;
    this.loadErrors(true);
  }

  private loadErrors(append: boolean = false): void {
    const eventId = this.eventId();
    if (!eventId || this.isLoading()) return;

    this.isLoading.set(true);

    this.participantService
      .getLatestBatchImportErrors(
        eventId,
        IMPORT_ERRORS_PAGE_SIZE,
        append ? this.lastEvaluatedKey : undefined,
      )
      .subscribe({
        next: (response) => {
          if (append) {
            this.errors.update((current) => [...current, ...(response.errors ?? [])]);
          } else {
            this.errors.set(response.errors ?? []);
          }
          this.lastEvaluatedKey = response.lastEvaluatedKey;
          this.hasMore.set(response.hasMore ?? false);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load import errors');
          this.isLoading.set(false);
        },
      });
  }
}
