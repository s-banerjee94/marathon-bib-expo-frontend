import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { AvatarModule } from 'primeng/avatar';

import { AuthService } from '../../../../core/services/auth.service';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { LayoutService } from '../../../../core/services/layout.service';
import {
  DashboardRange,
  OrgListItemDto,
  PlatformDashboardParams,
  PlatformDashboardResponse,
  PlatformRevenueResponse,
  TopOrgDto,
  TrendInterval,
  UpcomingEventDto,
} from '../../../../core/models/dashboard.model';
import { UserRole } from '../../../../core/models/user.model';
import { DefaultValuePipe } from '../../../../shared/pipes/default-value.pipe';
import { FormatEventDateTimePipe } from '../../../../shared/pipes/format-event-date-time-pipe';
import { InitialsPipe } from '../../../../shared/pipes/initials-pipe';
import { EmptyIllustration } from '../../../../shared/illustrations/empty-illustration';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import {
  DASHBOARD_DOUGHNUT_OPTIONS,
  DASHBOARD_SPARKLINE_OPTIONS,
  DASHBOARD_TIME_RANGE_OPTIONS,
  EVENT_STATUS_CHART_LABELS,
  EVENT_STATUS_COLORS,
  EVENTS_BY_CITY_COLORS,
  PLATFORM_CATEGORICAL_COLORS,
  PLATFORM_GROWTH_COLOR,
  PLATFORM_GROWTH_METRICS,
  PLATFORM_QUICK_ACTION_COLORS,
  PLATFORM_REVENUE_COLOR,
  PLATFORM_ROLE_COLORS_ADMIN,
  PLATFORM_ROLE_COLORS_ROOT,
  PLATFORM_ROLE_LABELS_ADMIN,
  PLATFORM_ROLE_LABELS_ROOT,
  PLATFORM_STAT_CARD_COLORS,
  PLATFORM_SUB_STATUS_COLORS,
} from '../../../../shared/constants/dashboard.constant';
import {
  getEventStatusLabel,
  getEventStatusSeverity,
} from '../../../../shared/utils/event-status.utils';
import {
  getSubscriptionStatusLabel,
  getSubscriptionStatusSeverity,
  getSubscriptionTierLabel,
  getSubscriptionTierSeverity,
} from '../../../../shared/utils/subscription-status.utils';
import {
  paletteAlpha,
  paletteRef,
  paletteResolve,
  paletteTint,
} from '../../../../shared/utils/chart-palette.util';

interface ChartConfig {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor?: string | string[];
    hoverBackgroundColor?: string[];
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    fill?: boolean;
    tension?: number;
    pointRadius?: number;
  }[];
}

interface LegendItem {
  label: string;
  value: number;
  percent: number;
  color: string;
}

type KpiKey = 'organizations' | 'events' | 'users' | 'activeEvents' | 'cities';
type GrowthMetric = 'users' | 'organizations' | 'events';

// Structural equality for the per-slice computed signals — a payload swap that
// doesn't change a slice produces no re-emit, so the chart's effect doesn't run.
const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// Title-cases a screaming-snake enum key (FREE → Free, PAST_DUE → Past Due).
const titleCase = (key: string): string =>
  key
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

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

// Turns a trend bucket label into a short axis tick. MONTH buckets arrive as
// "yyyy-MM" (→ "Oct-2026"); DAY/WEEK buckets arrive as "yyyy-MM-dd" (→ "5 Oct").
const formatBucketLabels = (labels: string[], interval: TrendInterval): string[] =>
  labels.map((label) => {
    const [yyyy, mm, dd] = label.split('-');
    const month = MONTH_ABBR[Number(mm) - 1];
    if (!month) return label;
    if (interval === 'MONTH' || !dd) return `${month}-${yyyy}`;
    return `${Number(dd)} ${month}`;
  });

@Component({
  selector: 'app-platform-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    CardModule,
    SkeletonModule,
    ChartModule,
    TableModule,
    TagModule,
    TooltipModule,
    SelectModule,
    SelectButtonModule,
    AvatarModule,
    DefaultValuePipe,
    FormatEventDateTimePipe,
    InitialsPipe,
    EmptyIllustration,
  ],
  templateUrl: './platform-dashboard.html',
  styleUrl: './platform-dashboard.css',
})
export class PlatformDashboard implements OnInit {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);
  private layout = inject(LayoutService);

  protected readonly inputSize = FORM_INPUT_SIZE;

  user = this.authService.currentUser;
  isRoot = this.authService.getCurrentRole() === UserRole.ROOT;
  roleLabel = this.isRoot ? 'ROOT' : 'ADMIN';

  // ── State ──
  data = signal<PlatformDashboardResponse | null>(null);
  isLoading = signal(true);
  isRefreshing = signal(false);
  // Plain flags read inside the load path — kept out of signals so they don't
  // re-trigger the fetch/effects (see org-dashboard for the rationale).
  private hasLoaded = false;
  private fetchInFlight = false;

  // `range` drives the KPI counts; the per-card ranges override their sections.
  range = signal<DashboardRange>('ALL');
  tierRange = signal<DashboardRange>('ALL');
  statusRange = signal<DashboardRange>('ALL');
  citiesRange = signal<DashboardRange>('ALL');
  growthMetric = signal<GrowthMetric>('users');

  // ── Revenue (separate endpoint) ──
  revenue = signal<PlatformRevenueResponse | null>(null);
  isLoadingRevenue = signal(true);
  private hasLoadedRevenue = false;
  private revenueFetchInFlight = false;

  // ── Charts ──
  growthChart = signal<ChartConfig | null>(null);
  tierChart = signal<ChartConfig | null>(null);
  subStatusChart = signal<ChartConfig | null>(null);
  eventStatusChart = signal<ChartConfig | null>(null);
  geoChart = signal<ChartConfig | null>(null);
  roleChart = signal<ChartConfig | null>(null);
  revenueChart = signal<ChartConfig | null>(null);
  sparklines = signal<Record<KpiKey, ChartConfig | null>>({
    organizations: null,
    events: null,
    users: null,
    activeEvents: null,
    cities: null,
  });

  // ── Options ──
  readonly timeRangeOptions = DASHBOARD_TIME_RANGE_OPTIONS;
  readonly growthMetrics = PLATFORM_GROWTH_METRICS;
  readonly doughnutOptions = DASHBOARD_DOUGHNUT_OPTIONS;
  readonly sparklineOptions = DASHBOARD_SPARKLINE_OPTIONS;

  // ── Derived scalars ──
  refreshedAt = computed(() => this.data()?.refreshedAt ?? null);
  totalOrganizations = computed(() => this.data()?.organizations.total ?? 0);
  totalEvents = computed(() => this.data()?.events.total ?? 0);
  activeEvents = computed(() => this.data()?.events.active ?? 0);
  totalUsers = computed(() => this.data()?.users.total ?? 0);
  distinctCities = computed(() => this.data()?.events.distinctCities ?? 0);

  topOrgs = computed<TopOrgDto[]>(() => this.data()?.organizations.top ?? []);
  recentOrgs = computed<OrgListItemDto[]>(() => this.data()?.organizations.recent ?? []);
  upcomingEvents = computed<UpcomingEventDto[]>(() => this.data()?.events.upcomingList ?? []);

  // ── Per-chart data slices (structural equality) ──
  private tierSlice = computed(() => this.data()?.organizations.byTier ?? {}, { equal: deepEqual });
  private subStatusSlice = computed(() => this.data()?.organizations.byStatus ?? {}, {
    equal: deepEqual,
  });
  private eventStatusSlice = computed(
    () => ({
      draft: this.data()?.events.byStatus?.['DRAFT'] ?? 0,
      published: this.data()?.events.byStatus?.['PUBLISHED'] ?? 0,
      completed: this.data()?.events.byStatus?.['COMPLETED'] ?? 0,
      cancelled: this.data()?.events.byStatus?.['CANCELLED'] ?? 0,
    }),
    { equal: deepEqual },
  );
  private citySlice = computed(() => this.data()?.events.byCity ?? [], { equal: deepEqual });
  private roleSlice = computed(() => this.data()?.users.byRole ?? {}, { equal: deepEqual });
  private trendsSlice = computed(() => this.data()?.trends ?? null, { equal: deepEqual });
  private revenueSlice = computed(() => this.revenue()?.trend ?? null, { equal: deepEqual });

  // ── KPI cards ──
  statCards = computed(() => [
    {
      key: 'organizations' as KpiKey,
      icon: 'pi pi-building',
      label: 'Organizations',
      value: this.totalOrganizations(),
      color: PLATFORM_STAT_CARD_COLORS['organizations'],
      linkLabel: 'Manage orgs',
      action: () => this.goToOrganizations(),
    },
    {
      key: 'events' as KpiKey,
      icon: 'pi pi-calendar',
      label: 'Events',
      value: this.totalEvents(),
      color: PLATFORM_STAT_CARD_COLORS['events'],
      linkLabel: 'View events',
      action: () => this.goToEvents(),
    },
    {
      key: 'users' as KpiKey,
      icon: 'pi pi-users',
      label: 'Users',
      value: this.totalUsers(),
      color: PLATFORM_STAT_CARD_COLORS['users'],
      linkLabel: 'View users',
      action: () => this.goToUsers(),
    },
    {
      key: 'activeEvents' as KpiKey,
      icon: 'pi pi-play-circle',
      label: 'Active Events',
      value: this.activeEvents(),
      color: PLATFORM_STAT_CARD_COLORS['activeEvents'],
      linkLabel: 'Draft + Published',
      action: () => this.goToEvents(),
    },
    {
      key: 'cities' as KpiKey,
      icon: 'pi pi-map-marker',
      label: 'Cities',
      value: this.distinctCities(),
      color: PLATFORM_STAT_CARD_COLORS['cities'],
      linkLabel: 'Geographic reach',
      action: () => this.goToEvents(),
    },
  ]);

  // Delta chip per KPI: last bucket minus the previous one in its trend series.
  kpiDeltas = computed<Record<KpiKey, number>>(() => {
    const s = this.trendsSlice()?.series;
    const delta = (arr?: number[]): number =>
      arr && arr.length >= 2 ? arr[arr.length - 1] - arr[arr.length - 2] : 0;
    return {
      organizations: delta(s?.organizations),
      events: delta(s?.events),
      users: delta(s?.users),
      activeEvents: delta(s?.activeEvents),
      cities: delta(s?.cities),
    };
  });

  // ── Doughnut legends ──
  tierLegend = computed<LegendItem[]>(() => {
    const entries = Object.entries(this.tierSlice());
    const colors = entries.map(
      (_, i) => PLATFORM_CATEGORICAL_COLORS[i % PLATFORM_CATEGORICAL_COLORS.length],
    );
    return this.toLegend(
      entries.map(([k]) => titleCase(k)),
      entries.map(([, v]) => v),
      colors,
    );
  });
  tierTotal = computed(() => this.tierLegend().reduce((s, i) => s + i.value, 0));

  subStatusLegend = computed<LegendItem[]>(() => {
    const entries = Object.entries(this.subStatusSlice());
    const colors = entries.map(
      ([k], i) =>
        PLATFORM_SUB_STATUS_COLORS[k] ??
        PLATFORM_CATEGORICAL_COLORS[i % PLATFORM_CATEGORICAL_COLORS.length],
    );
    return this.toLegend(
      entries.map(([k]) => titleCase(k)),
      entries.map(([, v]) => v),
      colors,
    );
  });
  subStatusTotal = computed(() => this.subStatusLegend().reduce((s, i) => s + i.value, 0));

  eventStatusLegend = computed<LegendItem[]>(() => {
    const s = this.eventStatusSlice();
    return this.toLegend(
      EVENT_STATUS_CHART_LABELS,
      [s.draft, s.published, s.completed, s.cancelled],
      EVENT_STATUS_COLORS,
    );
  });
  eventStatusTotal = computed(() => this.eventStatusLegend().reduce((s, i) => s + i.value, 0));

  roleLegend = computed<LegendItem[]>(() => {
    const labels = this.isRoot ? PLATFORM_ROLE_LABELS_ROOT : PLATFORM_ROLE_LABELS_ADMIN;
    const colors = this.isRoot ? PLATFORM_ROLE_COLORS_ROOT : PLATFORM_ROLE_COLORS_ADMIN;
    return this.toLegend(labels, this.roleCounts(), colors);
  });
  roleTotal = computed(() => this.roleLegend().reduce((s, i) => s + i.value, 0));

  // ROOT folds ROOT+ADMIN into a single "Admins" slice; ADMIN omits it entirely.
  private roleCounts(): number[] {
    const byRole = this.roleSlice();
    const orgAdmins = byRole[UserRole.ORGANIZER_ADMIN] ?? 0;
    const orgUsers = byRole[UserRole.ORGANIZER_USER] ?? 0;
    const distributors = byRole[UserRole.DISTRIBUTOR] ?? 0;
    if (this.isRoot) {
      const admins = (byRole[UserRole.ROOT] ?? 0) + (byRole[UserRole.ADMIN] ?? 0);
      return [admins, orgAdmins, orgUsers, distributors];
    }
    return [orgAdmins, orgUsers, distributors];
  }

  private toLegend(labels: string[], values: number[], colors: string[]): LegendItem[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    return labels.map((label, i) => ({
      label,
      value: values[i] ?? 0,
      color: paletteRef(colors[i]),
      percent: total ? ((values[i] ?? 0) / total) * 100 : 0,
    }));
  }

  // ── Revenue display ──
  revenueDisplay = computed(() => {
    const rev = this.revenue();
    if (!rev) return '—';
    return this.formatCurrency(rev.earned, rev.currency);
  });
  revenueDeltaPct = computed(() => this.revenue()?.deltaPct ?? null);
  revenueComparison = computed(() => this.revenue()?.comparisonLabel ?? null);
  hasRevenueTrend = computed(() => (this.revenue()?.trend.earned?.length ?? 0) > 0);

  private formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }

  // ── Quick actions (ROOT-only "Create Admin") ──
  quickActions = computed(() => {
    const actions: { icon: string; label: string; action: () => void }[] = [
      { icon: 'pi pi-building', label: 'Create Organization', action: () => this.goToCreateOrg() },
    ];
    if (this.isRoot) {
      actions.push({
        icon: 'pi pi-shield',
        label: 'Create Admin',
        action: () => this.goToCreateAdmin(),
      });
    }
    actions.push(
      { icon: 'pi pi-sitemap', label: 'Manage Orgs', action: () => this.goToOrganizations() },
      { icon: 'pi pi-users', label: 'Manage Users', action: () => this.goToUsers() },
      { icon: 'pi pi-calendar', label: 'View Events', action: () => this.goToEvents() },
      { icon: 'pi pi-history', label: 'Audit Logs', action: () => this.goToAuditLogs() },
    );
    return actions.map((qa, i) => ({
      ...qa,
      color: PLATFORM_QUICK_ACTION_COLORS[i % PLATFORM_QUICK_ACTION_COLORS.length],
    }));
  });

  // ── Chart options (theme-reactive bar/line) ──
  barOptions = computed(() => {
    this.trackTheme();
    const text = this.cssVar('--p-text-muted-color');
    const border = this.cssVar('--p-content-border-color');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { grid: { display: false }, ticks: { color: text } },
        y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: border } },
      },
    };
  });

  growthOptions = computed(() => {
    this.trackTheme();
    const text = this.cssVar('--p-text-muted-color');
    const border = this.cssVar('--p-content-border-color');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { grid: { display: false }, ticks: { color: text } },
        y: { ticks: { color: text, precision: 0 }, grid: { color: border } },
      },
    };
  });

  constructor() {
    effect(() => {
      this.trackTheme();
      this.tierSlice();
      this.rebuildTierChart();
    });
    effect(() => {
      this.trackTheme();
      this.subStatusSlice();
      this.rebuildSubStatusChart();
    });
    effect(() => {
      this.trackTheme();
      this.eventStatusSlice();
      this.rebuildEventStatusChart();
    });
    effect(() => {
      this.trackTheme();
      this.citySlice();
      this.rebuildGeoChart();
    });
    effect(() => {
      this.trackTheme();
      this.roleSlice();
      this.rebuildRoleChart();
    });
    effect(() => {
      this.trackTheme();
      this.trendsSlice();
      this.rebuildSparklines();
    });
    effect(() => {
      this.trackTheme();
      this.trendsSlice();
      this.growthMetric();
      this.rebuildGrowthChart();
    });
    effect(() => {
      this.trackTheme();
      this.revenueSlice();
      this.rebuildRevenueChart();
    });
  }

  private trackTheme(): void {
    this.layout.isDarkTheme();
    this.layout.selectedPrimary();
    this.layout.selectedSurface();
    this.layout.selectedPreset();
  }

  ngOnInit(): void {
    this.fetch();
    this.fetchRevenue();
  }

  private currentParams(): PlatformDashboardParams {
    return {
      range: this.range(),
      tierRange: this.tierRange(),
      statusRange: this.statusRange(),
      citiesRange: this.citiesRange(),
    };
  }

  private fetch(): void {
    if (this.fetchInFlight) return;
    this.fetchInFlight = true;
    const isFirstLoad = !this.hasLoaded;
    if (isFirstLoad) this.isLoading.set(true);
    this.dashboardService.getPlatformDashboard(this.currentParams()).subscribe({
      next: (res) => {
        this.data.set(res);
        this.hasLoaded = true;
        if (isFirstLoad) this.isLoading.set(false);
        this.fetchInFlight = false;
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load dashboard');
        this.hasLoaded = true;
        if (isFirstLoad) this.isLoading.set(false);
        this.fetchInFlight = false;
      },
    });
  }

  private fetchRevenue(): void {
    if (this.revenueFetchInFlight) return;
    this.revenueFetchInFlight = true;
    if (!this.hasLoadedRevenue) this.isLoadingRevenue.set(true);
    this.dashboardService.getPlatformRevenue({ range: this.range() }).subscribe({
      next: (res) => {
        this.revenue.set(res);
        this.hasLoadedRevenue = true;
        this.isLoadingRevenue.set(false);
        this.revenueFetchInFlight = false;
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load revenue');
        this.hasLoadedRevenue = true;
        this.isLoadingRevenue.set(false);
        this.revenueFetchInFlight = false;
      },
    });
  }

  refresh(): void {
    this.isRefreshing.set(true);
    this.dashboardService.refreshPlatformDashboard(this.currentParams()).subscribe({
      next: (res) => {
        this.data.set(res);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to refresh dashboard');
        this.isRefreshing.set(false);
      },
    });
    this.fetchRevenue();
  }

  onRangeChange(value: DashboardRange): void {
    if (value === this.range()) return;
    this.range.set(value);
    this.fetch();
    this.fetchRevenue();
  }

  onTierRangeChange(value: DashboardRange): void {
    if (value === this.tierRange()) return;
    this.tierRange.set(value);
    this.fetch();
  }

  onStatusRangeChange(value: DashboardRange): void {
    if (value === this.statusRange()) return;
    this.statusRange.set(value);
    this.fetch();
  }

  onCitiesRangeChange(value: DashboardRange): void {
    if (value === this.citiesRange()) return;
    this.citiesRange.set(value);
    this.fetch();
  }

  onGrowthMetricChange(value: GrowthMetric): void {
    this.growthMetric.set(value);
  }

  // ── Chart builders ──
  private rebuildTierChart(): void {
    const entries = Object.entries(this.tierSlice());
    this.tierChart.set({
      labels: entries.map(([k]) => titleCase(k)),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map((_, i) =>
            paletteResolve(PLATFORM_CATEGORICAL_COLORS[i % PLATFORM_CATEGORICAL_COLORS.length]),
          ),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildSubStatusChart(): void {
    const entries = Object.entries(this.subStatusSlice());
    this.subStatusChart.set({
      labels: entries.map(([k]) => titleCase(k)),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k], i) =>
            paletteResolve(
              PLATFORM_SUB_STATUS_COLORS[k] ??
                PLATFORM_CATEGORICAL_COLORS[i % PLATFORM_CATEGORICAL_COLORS.length],
            ),
          ),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildEventStatusChart(): void {
    const s = this.eventStatusSlice();
    this.eventStatusChart.set({
      labels: EVENT_STATUS_CHART_LABELS,
      datasets: [
        {
          data: [s.draft, s.published, s.completed, s.cancelled],
          backgroundColor: EVENT_STATUS_COLORS.map(paletteResolve),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildGeoChart(): void {
    const byCity = this.citySlice();
    this.geoChart.set({
      labels: byCity.map((c) => c.city),
      datasets: [
        {
          data: byCity.map((c) => c.count),
          backgroundColor: byCity.map((_, i) =>
            paletteResolve(EVENTS_BY_CITY_COLORS[i % EVENTS_BY_CITY_COLORS.length]),
          ),
          borderRadius: 6,
        },
      ],
    });
  }

  private rebuildRoleChart(): void {
    const labels = this.isRoot ? PLATFORM_ROLE_LABELS_ROOT : PLATFORM_ROLE_LABELS_ADMIN;
    const colors = this.isRoot ? PLATFORM_ROLE_COLORS_ROOT : PLATFORM_ROLE_COLORS_ADMIN;
    this.roleChart.set({
      labels,
      datasets: [
        {
          data: this.roleCounts(),
          backgroundColor: colors.map(paletteResolve),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildGrowthChart(): void {
    const trends = this.trendsSlice();
    const metric = this.growthMetric();
    const data = trends?.series[metric];
    if (!data || !data.length) {
      this.growthChart.set(null);
      return;
    }
    const stroke = paletteResolve(PLATFORM_GROWTH_COLOR);
    this.growthChart.set({
      labels: trends?.bucketLabels
        ? formatBucketLabels(trends.bucketLabels, trends.interval)
        : data.map((_, i) => `${i}`),
      datasets: [
        {
          data,
          borderColor: stroke,
          backgroundColor: paletteAlpha(stroke, 0.1),
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2.5,
        },
      ],
    });
  }

  private rebuildSparklines(): void {
    const trends = this.trendsSlice();
    const labels = trends?.bucketLabels ?? [];
    const buildSpark = (key: KpiKey, data: number[] | undefined): ChartConfig | null => {
      if (!data || !data.length) return null;
      const stroke = paletteResolve(PLATFORM_STAT_CARD_COLORS[key]);
      return {
        labels: labels.length === data.length ? labels : data.map((_, i) => `${i}`),
        datasets: [
          {
            data,
            borderColor: stroke,
            backgroundColor: paletteAlpha(stroke, 0.14),
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      };
    };
    this.sparklines.set({
      organizations: buildSpark('organizations', trends?.series.organizations),
      events: buildSpark('events', trends?.series.events),
      users: buildSpark('users', trends?.series.users),
      activeEvents: buildSpark('activeEvents', trends?.series.activeEvents),
      cities: buildSpark('cities', trends?.series.cities),
    });
  }

  private rebuildRevenueChart(): void {
    const trend = this.revenueSlice();
    if (!trend || !trend.earned.length) {
      this.revenueChart.set(null);
      return;
    }
    this.revenueChart.set({
      labels: formatBucketLabels(trend.bucketLabels, trend.interval),
      datasets: [
        {
          data: trend.earned,
          backgroundColor: paletteResolve(PLATFORM_REVENUE_COLOR),
          borderRadius: 4,
        },
      ],
    });
  }

  protected readonly statusSeverity = getEventStatusSeverity;
  protected readonly statusLabel = getEventStatusLabel;
  protected readonly orgStatusSeverity = getSubscriptionStatusSeverity;
  protected readonly orgStatusLabel = getSubscriptionStatusLabel;
  protected readonly tierSeverity = getSubscriptionTierSeverity;
  protected readonly tierLabel = getSubscriptionTierLabel;

  protected location(org: OrgListItemDto): string {
    return [org.city, org.stateProvince].filter(Boolean).join(', ');
  }

  // ── Theme palette helpers ──
  protected ref = paletteRef;
  protected tint = paletteTint;

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // ── Navigation ──
  goToOrganizations(): void {
    this.router.navigate(['/organizations']);
  }
  goToUsers(): void {
    this.router.navigate(['/users']);
  }
  goToEvents(): void {
    this.router.navigate(['/events']);
  }
  goToAuditLogs(): void {
    this.router.navigate(['/audit-logs']);
  }
  goToCreateOrg(): void {
    this.router.navigate(['/organizations'], { queryParams: { create: 'true' } });
  }
  goToCreateAdmin(): void {
    this.router.navigate(['/users'], {
      queryParams: { create: 'true', createRole: UserRole.ADMIN },
    });
  }
  goToOrgDetails(org: TopOrgDto | OrgListItemDto): void {
    this.router.navigate(['/organizations', org.id, 'edit']);
  }
  goToEventDetails(event: UpcomingEventDto): void {
    this.router.navigate(['/events', event.id]);
  }
}
