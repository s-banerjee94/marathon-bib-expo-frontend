import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { Menu } from 'primeng/menu';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MenuItem } from 'primeng/api';

import { ParticipantService } from '../../../../core/services/participant.service';
import { EventService } from '../../../../core/services/event.service';
import { ImportProgressService } from '../../../../core/services/import-progress.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CategoryStatistics,
  ParticipantStatisticsResponse,
  RaceStatistics,
} from '../../../../core/models/participant.model';
import { UserRole } from '../../../../core/models/user.model';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { EventDetailsState } from '../event-details-state.service';

interface DoughnutData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    hoverBackgroundColor: string[];
  }[];
}

const REBUILD_ROLES = [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN];

@Component({
  selector: 'app-event-dashboard-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-dashboard-section.html',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    CardModule,
    ChartModule,
    ConfirmPopupModule,
    Menu,
    ProgressBarModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TooltipModule,
  ],
  providers: [ConfirmationService],
})
export class EventDashboardSection implements OnInit {
  private readonly participantService = inject(ParticipantService);
  private readonly eventService = inject(EventService);
  private readonly importProgress = inject(ImportProgressService);
  private readonly authService = inject(AuthService);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toast = inject(ToastService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly state = inject(EventDetailsState);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly inputSize = FORM_INPUT_SIZE;

  protected readonly statistics = signal<ParticipantStatisticsResponse | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly isRefreshing = signal<boolean>(false);
  protected readonly isReconciling = signal<boolean>(false);
  protected readonly lastRefreshedAt = signal<Date | null>(null);

  // Race filter for the category breakdown. null = show all categories.
  // categoryToRaceMap is populated once per event-load from the races->categories API
  // so we can filter the (race-agnostic) categoryBreakdown by race membership.
  protected readonly selectedRaceFilter = signal<string | null>(null);
  private readonly categoryToRaceMap = signal<Map<string, string>>(new Map());

  protected readonly canRebuild = computed(() => this.authService.hasAnyRole(REBUILD_ROLES));
  protected readonly collectionPercent = computed(() => {
    const stats = this.statistics();
    if (!stats || stats.totalParticipants === 0) return 0;
    return (stats.bibCollectedCount / stats.totalParticipants) * 100;
  });

  protected readonly raceFilterOptions = computed<{ label: string; value: string }[]>(() => {
    const races = this.statistics()?.raceBreakdown ?? [];
    return races.map((r: RaceStatistics) => ({ label: r.raceName, value: r.raceId }));
  });

  protected readonly filteredCategoryBreakdown = computed<CategoryStatistics[]>(() => {
    const all = this.statistics()?.categoryBreakdown ?? [];
    const raceId = this.selectedRaceFilter();
    if (!raceId) return [];
    const map = this.categoryToRaceMap();
    return all.filter((c) => map.get(c.categoryId) === raceId);
  });

  protected readonly overflowMenuItems = signal<MenuItem[]>([]);
  protected readonly genderChartData = signal<DoughnutData | null>(null);
  protected readonly genderChartOptions = signal<object>({});

  private lastMenuTarget: EventTarget | null = null;

  ngOnInit(): void {
    this.buildOverflowMenu();
    this.buildChartOptions();
    this.loadStatistics(false);
    this.loadCategoryToRaceMap();

    this.importProgress.completed$
      .pipe(
        filter((c) => c.eventId === this.eventId() && c.status === 'COMPLETED'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadStatistics(false));
  }

  // Default to the first race so the category table always shows meaningful data.
  // Refreshes keep the user's current pick (if it still exists in the new race list).
  private seedDefaultRaceFilter(stats: ParticipantStatisticsResponse): void {
    const races = stats.raceBreakdown ?? [];
    if (races.length === 0) {
      this.selectedRaceFilter.set(null);
      return;
    }
    const current = this.selectedRaceFilter();
    const stillExists = current && races.some((r) => r.raceId === current);
    if (!stillExists) {
      this.selectedRaceFilter.set(races[0].raceId);
    }
  }

  private loadCategoryToRaceMap(): void {
    const id = this.eventId();
    if (!id) return;

    this.eventService.getRaces(id).subscribe({
      next: (races) => {
        if (races.length === 0) {
          this.categoryToRaceMap.set(new Map());
          return;
        }
        const calls = races.map((r) =>
          this.eventService.getCategoriesByRace(id, r.id).pipe(catchError(() => of([]))),
        );
        forkJoin(calls).subscribe((catLists) => {
          const map = new Map<string, string>();
          races.forEach((race, i) => {
            for (const cat of catLists[i]) {
              map.set(String(cat.id), String(race.id));
            }
          });
          this.categoryToRaceMap.set(map);
        });
      },
      error: () => this.categoryToRaceMap.set(new Map()),
    });
  }

  private eventId(): number | null {
    return this.state.event()?.id ?? null;
  }

  protected refresh(): void {
    this.loadStatistics(true);
  }

  protected showOverflowMenu(menu: Menu, event: MouseEvent): void {
    this.lastMenuTarget = event.currentTarget;
    menu.toggle(event);
  }

  private loadStatistics(showRefreshIndicator: boolean): void {
    const id = this.eventId();
    if (!id) return;

    if (showRefreshIndicator) {
      this.isRefreshing.set(true);
    } else if (!this.statistics()) {
      this.isLoading.set(true);
    }

    this.participantService.getParticipantStatistics(id).subscribe({
      next: (stats) => {
        this.statistics.set(stats);
        this.lastRefreshedAt.set(new Date());
        this.buildGenderChart(stats);
        this.seedDefaultRaceFilter(stats);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.errorHandler.showError(err, 'Failed to load participant statistics');
      },
    });
  }

  private rebuildCounters(): void {
    const id = this.eventId();
    if (!id || this.isReconciling()) return;

    this.isReconciling.set(true);
    this.participantService.reconcileParticipantStatistics(id).subscribe({
      next: (stats) => {
        this.statistics.set(stats);
        this.lastRefreshedAt.set(new Date());
        this.buildGenderChart(stats);
        this.seedDefaultRaceFilter(stats);
        this.isReconciling.set(false);
        this.toast.success('Statistics counters rebuilt', 'Counters refreshed');
      },
      error: (err) => {
        this.isReconciling.set(false);
        this.errorHandler.showError(err, 'Failed to rebuild counters');
      },
    });
  }

  private buildOverflowMenu(): void {
    this.overflowMenuItems.set([
      {
        label: 'Rebuild counters',
        icon: 'pi pi-refresh',
        visible: this.canRebuild(),
        command: () => this.confirmRebuild(),
      },
    ]);
  }

  private confirmRebuild(): void {
    this.confirmation.confirm({
      target: this.lastMenuTarget as EventTarget,
      message: 'Rebuild counters from a full participant scan? This can be slow on large events.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Rebuild',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => this.rebuildCounters(),
    });
  }

  private buildChartOptions(): void {
    const ds = getComputedStyle(document.documentElement);
    const textColor = ds.getPropertyValue('--p-text-color').trim() || '#374151';
    this.genderChartOptions.set({
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, boxWidth: 12, font: { size: 12 } },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    });
  }

  private buildGenderChart(stats: ParticipantStatisticsResponse): void {
    const ds = getComputedStyle(document.documentElement);
    const g = stats.genderBreakdown ?? { male: 0, female: 0, other: 0 };
    this.genderChartData.set({
      labels: ['Male', 'Female', 'Other'],
      datasets: [
        {
          data: [g.male ?? 0, g.female ?? 0, g.other ?? 0],
          backgroundColor: [
            ds.getPropertyValue('--p-blue-500').trim() || '#3b82f6',
            ds.getPropertyValue('--p-pink-500').trim() || '#ec4899',
            ds.getPropertyValue('--p-gray-400').trim() || '#9ca3af',
          ],
          hoverBackgroundColor: [
            ds.getPropertyValue('--p-blue-400').trim() || '#60a5fa',
            ds.getPropertyValue('--p-pink-400').trim() || '#f472b6',
            ds.getPropertyValue('--p-gray-300').trim() || '#d1d5db',
          ],
        },
      ],
    });
  }

  protected racePercent(count: number, collected: number): number {
    return count === 0 ? 0 : (collected / count) * 100;
  }
}
