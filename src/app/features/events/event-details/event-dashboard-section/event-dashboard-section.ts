import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { KnobModule } from 'primeng/knob';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { EventDashboardService } from '../../../../core/services/event-dashboard.service';
import { DistributionService } from '../../../../core/services/distribution.service';
import { ImportProgressService } from '../../../../core/services/import-progress.service';
import { AuthService } from '../../../../core/services/auth.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import {
  CategoryStat,
  EventActivity,
  EventDashboardRange,
  EventDashboardResponse,
  GenderBreakdown,
  ParticipantTotals,
  RaceStat,
  DashboardTimeline,
} from '../../../../core/models/event-dashboard.model';
import { DistributionLogResponse } from '../../../../core/models/distribution.model';
import { UserRole } from '../../../../core/models/user.model';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import {
  COLLECTED_ACCENT,
  DASHBOARD_DOUGHNUT_OPTIONS,
  DASHBOARD_POLL_INTERVAL_MS,
  EVENT_DASHBOARD_RANGE_OPTIONS,
  GENDER_CHART_COLORS,
  GENDER_CHART_LABELS,
  RACE_DISTRIBUTION_COLORS,
  RECENT_COLLECTIONS_LIMIT,
} from '../../../../shared/constants/event-dashboard.constant';
import {
  paletteAlpha,
  paletteRef,
  paletteResolve,
  paletteTint,
} from '../../../../shared/utils/chart-palette.util';
import { InitialsPipe } from '../../../../shared/pipes/initials-pipe';
import { UserNamePipe } from '../../../../shared/pipes/user-name-pipe';
import { EventDetailsState } from '../event-details-state.service';

interface ChartDataset {
  label?: string;
  data: (number | null)[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  borderDash?: number[];
  tension?: number;
  fill?: boolean;
  pointRadius?: number;
}

interface ChartConfig {
  labels: string[];
  datasets: ChartDataset[];
}

interface LegendItem {
  label: string;
  value: number;
  percent: number;
  color: string;
}

interface BarRow {
  /** Stable identity for `@for` tracking — names can collide (two distributors
   *  sharing a name, a category name reused across races). */
  key: string;
  name: string;
  count: number;
  total?: number;
  percent: number;
}

// Roles the backend allows to read distribution logs (Recent Collections feed).
// Mirrors the distribution Activity Logs tab guard; distributors are excluded.
const LOG_VIEW_ROLES = [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN];

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Structural equality for the per-slice computeds: a payload swap that doesn't
// actually change a slice produces no re-emit, so that slice's chart effect
// (and only that one) stays idle. Slices are primitives, plain arrays, and
// plain records, so JSON.stringify is sufficient and cheap.
const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// Bucket for categories the backend reports with a null raceId (the race was
// deleted while participants still referenced the category).
const ORPHAN_RACE_KEY = '__unassigned__';

const EMPTY_TOTALS: ParticipantTotals = { total: 0, collected: 0, pending: 0, collectedPercent: 0 };
const EMPTY_GENDER: GenderBreakdown = { male: 0, female: 0, other: 0 };

@Component({
  selector: 'app-event-dashboard-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-dashboard-section.html',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    AvatarModule,
    ButtonModule,
    CardModule,
    ChartModule,
    KnobModule,
    ProgressBarModule,
    SelectModule,
    SelectButtonModule,
    SkeletonModule,
    TagModule,
    TooltipModule,
    InitialsPipe,
    UserNamePipe,
  ],
})
export class EventDashboardSection implements OnInit {
  private readonly dashboardService = inject(EventDashboardService);
  private readonly distributionService = inject(DistributionService);
  private readonly importProgress = inject(ImportProgressService);
  private readonly authService = inject(AuthService);
  private readonly layout = inject(LayoutService);
  private readonly errorHandler = inject(ErrorHandlerService);
  // Present when hosted inside the event-details shell (/events/:id/dashboard);
  // absent in the distribution shell (/distribution/event/:eventId/dashboard),
  // where the eventId comes from the route instead.
  private readonly state = inject(EventDetailsState, { optional: true });
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Optional explicit event id — set when the dashboard is embedded outside a
   * routed `:eventId` context (the distributor's own /dashboard). Falls back to
   * EventDetailsState (events shell) or the route param (distribution shell).
   */
  readonly assignedEventId = input<number | null>(null);

  protected readonly inputSize = FORM_INPUT_SIZE;
  protected readonly rangeOptions = EVENT_DASHBOARD_RANGE_OPTIONS;

  // ── State ──
  protected readonly dashboard = signal<EventDashboardResponse | null>(null);
  protected readonly range = signal<EventDashboardRange>('TODAY');
  protected readonly isLoading = signal<boolean>(true);
  protected readonly isRefreshing = signal<boolean>(false);
  // Race filter for the category breakdown (raceId; categories carry their own
  // raceId so filtering is purely client-side — no extra round-trips).
  protected readonly selectedRaceFilter = signal<string | null>(null);

  // Recent Collections feed (separate live endpoint, not part of the rollup).
  protected readonly recentLogs = signal<DistributionLogResponse[]>([]);
  protected readonly isLoadingRecent = signal<boolean>(true);

  // Plain (non-signal) guards: read outside the reactive graph so a fetch's
  // own `dashboard.set()` can't re-trigger the loading logic.
  private hasLoaded = false;
  private recentLoaded = false;
  private fetchInFlight = false;

  // Recent Collections reads the distribution logs endpoint, which the backend
  // restricts to log-viewing roles (the same set the distribution Activity Logs
  // tab uses). Distributors get 403 there, so skip the call and hide the card.
  protected readonly canViewRecentLogs = computed(() =>
    this.authService.hasAnyRole(LOG_VIEW_ROLES),
  );

  // ── Chart options ──
  // Reference-stable literals so PrimeNG Chart never sees a new `options` ref.
  protected readonly doughnutOptions = DASHBOARD_DOUGHNUT_OPTIONS;
  // Line-chart axis/grid colours follow the theme, so this one is a computed.
  protected readonly timelineOptions = computed(() => {
    this.trackTheme();
    const text = this.cssVar('--p-text-muted-color');
    const border = this.cssVar('--p-content-border-color');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.hasTimelineLegend(),
          position: 'bottom',
          labels: { color: text, usePointStyle: true, boxWidth: 12, padding: 16 },
        },
        tooltip: { enabled: true },
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: text, maxTicksLimit: 5 }, grid: { color: border } },
        x: { ticks: { color: text }, grid: { display: false } },
      },
    };
  });

  // ── Chart data (canvas) — rebuilt by theme/data effects ──
  protected readonly timelineChart = signal<ChartConfig | null>(null);
  protected readonly genderChart = signal<ChartConfig | null>(null);
  protected readonly raceDistChart = signal<ChartConfig | null>(null);

  // ── Per-slice computeds (structural equality) ──
  private readonly participantsSlice = computed<ParticipantTotals>(
    () => this.dashboard()?.participants ?? EMPTY_TOTALS,
    { equal: deepEqual },
  );
  private readonly genderSlice = computed<GenderBreakdown>(
    () => this.dashboard()?.gender ?? EMPTY_GENDER,
    { equal: deepEqual },
  );
  private readonly racesSlice = computed<RaceStat[]>(() => this.dashboard()?.races ?? [], {
    equal: deepEqual,
  });
  private readonly categoriesSlice = computed<CategoryStat[]>(
    () => this.dashboard()?.categories ?? [],
    { equal: deepEqual },
  );
  private readonly activitySlice = computed<EventActivity | null>(
    () => this.dashboard()?.activity ?? null,
    { equal: deepEqual },
  );
  private readonly timelineSlice = computed<DashboardTimeline | null>(
    () => this.dashboard()?.activity?.timeline ?? null,
    { equal: deepEqual },
  );

  // ── Template-facing derived state ──
  protected readonly refreshedAt = computed(() => this.dashboard()?.refreshedAt ?? null);
  protected readonly rangeChip = computed(() => (this.range() === 'TODAY' ? 'Today' : 'Full Expo'));
  protected readonly hasParticipants = computed(() => this.participantsSlice().total > 0);

  protected readonly totalParticipants = computed(() => this.participantsSlice().total);
  protected readonly racesCount = computed(() => this.racesSlice().length);
  protected readonly overallPercent = computed(() => this.participantsSlice().collectedPercent);
  protected readonly collectedCount = computed(() => this.participantsSlice().collected);
  protected readonly pendingCount = computed(() => this.participantsSlice().pending);

  protected readonly collectedInWindow = computed(() => this.activitySlice()?.collected ?? 0);
  protected readonly collectedSubtitle = computed(() => {
    const a = this.activitySlice();
    if (!a) return '';
    if (this.range() === 'TODAY') return 'picked up today';
    return `${(a.collectedPercentOfTotal ?? 0).toFixed(1)}% of roster`;
  });
  protected readonly rateValue = computed(() => this.activitySlice()?.rate?.value ?? 0);
  protected readonly rateSubtitle = computed(() =>
    this.range() === 'TODAY' ? 'live · per hour' : 'avg · per expo hour',
  );
  protected readonly peakLabel = computed(() => {
    const peak = this.activitySlice()?.peak;
    if (!peak) return '—';
    const hour = this.formatHour(this.hourOf(peak.bucketStart));
    return this.range() === 'FULL_EXPO' ? `Day ${peak.dayIndex} · ${hour}` : hour;
  });
  protected readonly peakSubtitle = computed(() => {
    const peak = this.activitySlice()?.peak;
    return peak ? `${peak.count} bibs in the hour` : 'no collections yet';
  });

  // Doughnut legends + centre totals (DOM swatches use live var(--p-…) refs).
  protected readonly genderLegend = computed<LegendItem[]>(() => {
    const g = this.genderSlice();
    return this.toLegend(GENDER_CHART_LABELS, [g.male, g.female, g.other], GENDER_CHART_COLORS);
  });
  protected readonly raceDistLegend = computed<LegendItem[]>(() => {
    const races = this.racesSlice();
    return this.toLegend(
      races.map((r) => r.raceName),
      races.map((r) => r.total),
      races.map((_, i) => RACE_DISTRIBUTION_COLORS[i % RACE_DISTRIBUTION_COLORS.length]),
    );
  });
  protected readonly raceDistTotal = computed(() =>
    this.racesSlice().reduce((sum, r) => sum + r.total, 0),
  );

  // Race-wise collection bars (event-wide).
  protected readonly raceBars = computed<BarRow[]>(() =>
    this.racesSlice().map((r) => ({
      key: r.raceId,
      name: r.raceName,
      count: r.collected,
      total: r.total,
      percent: r.total ? (r.collected / r.total) * 100 : 0,
    })),
  );

  // Category collection progress for the selected race.
  protected readonly raceFilterOptions = computed<{ label: string; value: string }[]>(() => {
    const options = this.racesSlice().map((r) => ({ label: r.raceName, value: r.raceId }));
    // Categories whose race is gone arrive with a null raceId. They still hold
    // participants, so give them a bucket rather than dropping them silently.
    if (this.categoriesSlice().some((c) => c.raceId == null)) {
      options.push({ label: 'Unassigned', value: ORPHAN_RACE_KEY });
    }
    return options;
  });
  protected readonly filteredCategories = computed<BarRow[]>(() => {
    const raceId = this.selectedRaceFilter();
    if (!raceId) return [];
    return this.categoriesSlice()
      .filter((c) => (c.raceId ?? ORPHAN_RACE_KEY) === raceId)
      .map((c) => ({
        key: c.categoryId,
        name: c.categoryName,
        count: c.collected,
        total: c.total,
        percent: c.total ? (c.collected / c.total) * 100 : 0,
      }));
  });

  // Distributor activity bars (range-scoped, relative to the busiest).
  protected readonly distributorBars = computed<BarRow[]>(() => {
    const dist = this.activitySlice()?.distributors ?? [];
    const max = dist.reduce((m, d) => Math.max(m, d.count), 0) || 1;
    return dist.map((d) => ({
      key: d.distributorId,
      name: d.name,
      count: d.count,
      percent: (d.count / max) * 100,
    }));
  });

  private readonly hasTimelineLegend = computed(() => {
    if (this.range() !== 'TODAY') return false;
    const compare = this.timelineSlice()?.series.find((s) => s.key === 'compare');
    return !!compare && compare.points.length > 0;
  });

  constructor() {
    // Per-chart rebuild effects. Each tracks (theme tokens × its own slice), so
    // a range flip repaints only the activity charts, and a theme change rebuilds
    // everything (canvas can't consume CSS custom properties live).
    effect(() => {
      this.trackTheme();
      this.genderSlice();
      this.rebuildGender();
    });
    effect(() => {
      this.trackTheme();
      this.racesSlice();
      this.rebuildRaceDist();
    });
    effect(() => {
      this.trackTheme();
      this.timelineSlice();
      this.range();
      this.rebuildTimeline();
    });
  }

  ngOnInit(): void {
    this.fetch();
    this.fetchRecentLogs();

    // Reflect a finished import without a manual refresh.
    this.importProgress.completed$
      .pipe(
        filter((c) => c.eventId === this.eventId() && c.status === 'COMPLETED'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.fetch(true);
        this.fetchRecentLogs(true);
      });

    // Keep the live activity + feed fresh. Unmounts (tab switch) stop the poll.
    interval(DASHBOARD_POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fetch(true);
        this.fetchRecentLogs(true);
      });
  }

  private eventId(): number | null {
    // Embedded with an explicit id (distributor's own /dashboard).
    const fromInput = this.assignedEventId();
    if (fromInput != null) return fromInput;
    const fromState = this.state?.event()?.id;
    if (fromState != null) return fromState;
    // Distribution shell: `eventId` is inherited onto this route's paramMap
    // (router paramsInheritanceStrategy is 'always').
    const fromRoute = this.route.snapshot.paramMap.get('eventId');
    return fromRoute != null && Number.isFinite(Number(fromRoute)) ? Number(fromRoute) : null;
  }

  protected refresh(): void {
    this.fetch(false);
    this.fetchRecentLogs(false);
  }

  protected onRangeChange(value: EventDashboardRange): void {
    if (!value || value === this.range()) return;
    this.range.set(value);
    this.fetch(false);
  }

  private fetch(silent = false): void {
    const id = this.eventId();
    if (id == null || this.fetchInFlight) return;
    this.fetchInFlight = true;

    const firstLoad = !this.hasLoaded;
    if (firstLoad) this.isLoading.set(true);
    else if (!silent) this.isRefreshing.set(true);

    this.dashboardService.getEventDashboard(id, this.range()).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.seedRaceFilter();
        this.hasLoaded = true;
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.fetchInFlight = false;
      },
      error: (err) => {
        this.hasLoaded = true;
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.fetchInFlight = false;
        if (!silent) this.errorHandler.showError(err, 'Failed to load event dashboard');
      },
    });
  }

  private fetchRecentLogs(silent = false): void {
    // The logs endpoint 403s for roles without log access (e.g. distributors);
    // the card is hidden for them, so don't even make the request.
    if (!this.canViewRecentLogs()) return;
    const id = this.eventId();
    if (id == null) return;
    if (!silent && !this.recentLoaded) this.isLoadingRecent.set(true);

    this.distributionService
      .lookupLogs(id, 'ACTION', 'BIB_COLLECTED', RECENT_COLLECTIONS_LIMIT)
      .subscribe({
        next: (res) => {
          this.recentLogs.set(res.logs ?? []);
          this.recentLoaded = true;
          this.isLoadingRecent.set(false);
        },
        error: (err) => {
          this.recentLoaded = true;
          this.isLoadingRecent.set(false);
          if (!silent) this.errorHandler.showError(err, 'Failed to load recent collections');
        },
      });
  }

  // Default the category filter to the first option; refreshes keep the user's
  // pick when it still exists in the new list.
  private seedRaceFilter(): void {
    const options = this.raceFilterOptions();
    if (options.length === 0) {
      this.selectedRaceFilter.set(null);
      return;
    }
    const current = this.selectedRaceFilter();
    if (!current || !options.some((o) => o.value === current)) {
      this.selectedRaceFilter.set(options[0].value);
    }
  }

  // ── Chart builders ──
  private rebuildGender(): void {
    const g = this.genderSlice();
    this.genderChart.set({
      labels: GENDER_CHART_LABELS,
      datasets: [
        {
          data: [g.male, g.female, g.other],
          backgroundColor: GENDER_CHART_COLORS.map(paletteResolve),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildRaceDist(): void {
    const races = this.racesSlice();
    this.raceDistChart.set({
      labels: races.map((r) => r.raceName),
      datasets: [
        {
          data: races.map((r) => r.total),
          backgroundColor: races.map((_, i) =>
            paletteResolve(RACE_DISTRIBUTION_COLORS[i % RACE_DISTRIBUTION_COLORS.length]),
          ),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildTimeline(): void {
    const timeline = this.timelineSlice();
    if (!timeline) {
      this.timelineChart.set(null);
      return;
    }
    const stroke = paletteResolve(COLLECTED_ACCENT);
    const fill = paletteAlpha(stroke, 0.16);
    const primary = timeline.series.find((s) => s.key === 'primary');
    const compare = timeline.series.find((s) => s.key === 'compare');

    // FULL_EXPO (or TODAY day-1 with no prior day): one continuous series, one
    // label per point. Hour-of-day repeats across days, so don't collapse it.
    if (this.range() === 'FULL_EXPO' || !compare || compare.points.length === 0) {
      const points = primary?.points ?? [];
      // Nothing collected in the window: show the empty state, not blank axes.
      if (points.length === 0) {
        this.timelineChart.set(null);
        return;
      }
      const multiDay = this.range() === 'FULL_EXPO';
      this.timelineChart.set({
        // Full Expo spans days, so label with the calendar date + hour
        // ("17 Jun 8p") rather than an expo-day offset — the latter reads as
        // "D-1"/"D0" for any pickups recorded before the configured expo start.
        labels: points.map((p) =>
          multiDay
            ? `${this.dayShort(p.bucketStart)} ${this.hourShort(p.bucketStart)}`
            : this.hourLabel(p.bucketStart),
        ),
        datasets: [
          {
            label: primary?.label ?? 'Bibs collected',
            data: points.map((p) => p.count),
            borderColor: stroke,
            backgroundColor: fill,
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
          },
        ],
      });
      return;
    }

    // TODAY with a comparison day: overlay both series on a shared hour-of-day axis.
    const primaryPts = primary?.points ?? [];
    const hours = Array.from(
      new Set([
        ...primaryPts.map((p) => this.hourOf(p.bucketStart)),
        ...compare.points.map((p) => this.hourOf(p.bucketStart)),
      ]),
    ).sort((a, b) => a - b);
    const pMap = new Map(primaryPts.map((p) => [this.hourOf(p.bucketStart), p.count]));
    const cMap = new Map(compare.points.map((p) => [this.hourOf(p.bucketStart), p.count]));
    const muted = this.cssVar('--p-text-muted-color') || '#9ca3af';

    this.timelineChart.set({
      labels: hours.map((h) => this.formatHour(h)),
      datasets: [
        {
          label: compare.label,
          data: hours.map((h) => cMap.get(h) ?? null),
          borderColor: muted,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          tension: 0.4,
          pointRadius: 0,
          fill: false,
        },
        {
          label: primary?.label ?? 'Today',
          data: hours.map((h) => pMap.get(h) ?? null),
          borderColor: stroke,
          backgroundColor: fill,
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
        },
      ],
    });
  }

  // ── Helpers ──
  private toLegend(labels: string[], values: number[], colors: string[]): LegendItem[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    return labels.map((label, i) => ({
      label,
      value: values[i],
      color: paletteRef(colors[i]),
      percent: total ? (values[i] / total) * 100 : 0,
    }));
  }

  // bucketStart is already in the event's time zone (offset embedded), so the
  // hour is read straight off the string — no UTC conversion, no tz math.
  private hourOf(iso: string): number {
    const h = parseInt(iso.slice(11, 13), 10);
    return Number.isNaN(h) ? new Date(iso).getHours() : h;
  }
  private hourLabel(iso: string): string {
    return this.formatHour(this.hourOf(iso));
  }
  private hourShort(iso: string): string {
    const h = this.hourOf(iso);
    const h12 = h % 12 || 12;
    return `${h12}${h < 12 ? 'a' : 'p'}`;
  }
  /** Calendar-date label off the tz-offset string (no UTC conversion), e.g. "17 Jun". */
  private dayShort(iso: string): string {
    const month = Number(iso.slice(5, 7));
    const day = Number(iso.slice(8, 10));
    return `${day} ${MONTH_ABBR[month - 1] ?? ''}`.trim();
  }
  private formatHour(hour: number): string {
    const h12 = hour % 12 || 12;
    return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
  }

  private trackTheme(): void {
    this.layout.isDarkTheme();
    this.layout.selectedPrimary();
    this.layout.selectedSurface();
    this.layout.selectedPreset();
  }
  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  protected readonly ref = paletteRef;
  protected readonly tint = paletteTint;
}
