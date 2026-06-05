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
import { AvatarModule } from 'primeng/avatar';

import { AuthService } from '../../../core/services/auth.service';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { LayoutService } from '../../../core/services/layout.service';
import {
  DashboardRange,
  OrgDashboardParams,
  OrgDashboardResponse,
  EventListItemDto,
} from '../../../core/models/dashboard.model';
import { AuditLog } from '../../../core/models/audit-log.model';
import { UserRole } from '../../../core/models/user.model';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { FormatEventDateTimePipe } from '../../../shared/pipes/format-event-date-time-pipe';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import {
  AUDIT_ACTION_LABEL,
  resolveAuditActivityIcon,
} from '../../../shared/constants/audit-log.constant';
import {
  DASHBOARD_DOUGHNUT_OPTIONS,
  DASHBOARD_SPARKLINE_OPTIONS,
  DASHBOARD_TIME_RANGE_OPTIONS,
  EVENT_STATUS_CHART_LABELS,
  EVENT_STATUS_PALETTE_TOKENS,
  RECENT_ACTIVITY_LIMIT,
  USER_ROLE_CHART_LABELS,
  USER_ROLE_PALETTE_TOKENS,
} from '../../../shared/constants/dashboard.constant';
import {
  getEventStatusLabel,
  getEventStatusSeverity,
} from '../../../shared/utils/event-status.utils';

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

interface ActivityRow {
  id: string;
  icon: string;
  actionLabel: string;
  description: string;
  actorName: string;
  createdAt: string;
}

type SparkKey = 'events' | 'active' | 'users' | 'cities';

// Structural equality for the per-slice computed signals. Two snapshots that
// serialize identically are treated as equal, so swapping `data` for a server
// response that didn't actually change a slice produces no re-emit and the
// downstream chart effect doesn't run. The slices are primitives, plain
// arrays, and plain-record maps — JSON.stringify is sufficient and cheap.
const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

@Component({
  selector: 'app-org-dashboard',
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
    AvatarModule,
    DefaultValuePipe,
    FormatEventDateTimePipe,
  ],
  templateUrl: './org-dashboard.html',
  styleUrl: './org-dashboard.css',
})
export class OrgDashboard implements OnInit {
  private authService = inject(AuthService);
  private auditLogService = inject(AuditLogService);
  private dashboardService = inject(DashboardService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);
  private layout = inject(LayoutService);

  protected readonly inputSize = FORM_INPUT_SIZE;

  user = this.authService.currentUser;

  // ── State ──
  data = signal<OrgDashboardResponse | null>(null);
  isLoading = signal(true);
  isRefreshing = signal(false);
  // Plain (non-signal) flag — read inside the load effect to decide whether to
  // show skeletons. Using `this.data() === null` here would track `data` as an
  // effect dependency, and the subsequent `this.data.set(res)` would re-fire
  // the effect, fetching forever.
  private hasLoaded = false;
  // In-flight guard. Defensive: prevents any future change to the call sites
  // (or HMR-induced double-mounts in dev) from issuing overlapping GETs to the
  // same endpoint.
  private fetchInFlight = false;

  // `range` drives the stat-card numbers (events.total, events.upcoming).
  // `statusRange` and `citiesRange` drive their respective card charts independently.
  range = signal<DashboardRange>('ALL');
  statusRange = signal<DashboardRange>('ALL');
  citiesRange = signal<DashboardRange>('ALL');

  // ── Charts ──
  eventStatusChart = signal<ChartConfig | null>(null);
  userRoleChart = signal<ChartConfig | null>(null);
  eventsByCityChart = signal<ChartConfig | null>(null);
  sparklines = signal<Record<SparkKey, ChartConfig | null>>({
    events: null,
    active: null,
    users: null,
    cities: null,
  });

  // ── Range dropdown options ──
  readonly timeRangeOptions = DASHBOARD_TIME_RANGE_OPTIONS;

  // ── Recent Activity (audit logs) ──
  private recentActivityRaw = signal<AuditLog[]>([]);
  isLoadingActivity = signal(true);
  isRefreshingActivity = signal(false);
  private hasLoadedActivity = false;
  private activityFetchInFlight = false;

  recentActivity = computed<ActivityRow[]>(() =>
    this.recentActivityRaw().map((log) => ({
      id: log.id,
      icon: resolveAuditActivityIcon(log.action, log.entityType),
      actionLabel: AUDIT_ACTION_LABEL[log.action] ?? log.action,
      description: log.description ?? `${log.action} ${log.entityType}`,
      actorName: log.actorName ?? '—',
      createdAt: log.createdAt,
    })),
  );

  // ── Derived from data() ──
  organization = computed(() => this.data()?.organization ?? null);
  refreshedAt = computed(() => this.data()?.refreshedAt ?? null);

  totalEvents = computed(() => this.data()?.events.total ?? 0);
  upcomingEvents = computed(() => this.data()?.events.upcoming ?? 0);
  publishedEventsCount = computed(() => this.data()?.events.byStatus?.['PUBLISHED'] ?? 0);
  // "Active" on the stat card = anything not finished or cancelled — i.e. Draft + Published.
  activeEventsCount = computed(
    () =>
      (this.data()?.events.byStatus?.['DRAFT'] ?? 0) +
      (this.data()?.events.byStatus?.['PUBLISHED'] ?? 0),
  );
  completedEventsCount = computed(() => this.data()?.events.byStatus?.['COMPLETED'] ?? 0);
  cancelledEventsCount = computed(() => this.data()?.events.byStatus?.['CANCELLED'] ?? 0);
  distinctCities = computed(() => this.data()?.events.distinctCities ?? 0);
  totalUsers = computed(() => this.data()?.users.total ?? 0);

  activeEvents = computed<EventListItemDto[]>(() => this.data()?.events.active ?? []);
  recentEvents = computed<EventListItemDto[]>(() => this.data()?.events.recent ?? []);

  // ── Per-chart data slices ──
  // Each slice uses structural equality. When the rollup endpoint returns a
  // new payload but a particular slice's contents are unchanged, the computed
  // doesn't re-emit and the chart's effect doesn't run — so the chart isn't
  // re-painted. This is why changing `citiesRange` repaints only the city bar.
  private statusSlice = computed(
    () => ({
      draft: this.data()?.events.byStatus?.['DRAFT'] ?? 0,
      published: this.data()?.events.byStatus?.['PUBLISHED'] ?? 0,
      completed: this.data()?.events.byStatus?.['COMPLETED'] ?? 0,
      cancelled: this.data()?.events.byStatus?.['CANCELLED'] ?? 0,
    }),
    { equal: deepEqual },
  );
  private draftEventsCount = computed(() => this.data()?.events.byStatus?.['DRAFT'] ?? 0);
  private citySlice = computed(() => this.data()?.events.byCity ?? [], { equal: deepEqual });
  private roleSlice = computed(() => this.data()?.users.byRole ?? {}, { equal: deepEqual });
  private trendsSlice = computed(() => this.data()?.trends ?? null, { equal: deepEqual });

  statCards = computed(() => [
    {
      icon: 'pi pi-calendar',
      label: 'Total Events',
      value: this.totalEvents(),
      subtitle: 'All time',
      sparkKey: 'events' as SparkKey,
      linkLabel: 'View all events',
      action: () => this.goToEvents(),
    },
    {
      icon: 'pi pi-play-circle',
      label: 'Active Events',
      value: this.activeEventsCount(),
      subtitle: 'Currently running',
      sparkKey: 'active' as SparkKey,
      linkLabel: 'View active events',
      action: () => this.goToEvents(),
    },
    {
      icon: 'pi pi-users',
      label: 'Total Users',
      value: this.totalUsers(),
      subtitle: 'All users',
      sparkKey: 'users' as SparkKey,
      linkLabel: 'View users',
      action: () => this.goToUsers(),
    },
    {
      icon: 'pi pi-map-marker',
      label: 'Cities',
      value: this.distinctCities(),
      subtitle: 'All locations',
      sparkKey: 'cities' as SparkKey,
      linkLabel: 'View locations',
      action: () => this.goToEvents(),
    },
  ]);

  eventStatusLegend = computed<LegendItem[]>(() => {
    const values = [
      this.draftEventsCount(),
      this.publishedEventsCount(),
      this.completedEventsCount(),
      this.cancelledEventsCount(),
    ];
    return this.toLegend(EVENT_STATUS_CHART_LABELS, values, this.statusTokens);
  });
  eventStatusTotal = computed(() => this.eventStatusLegend().reduce((s, i) => s + i.value, 0));

  roleLegend = computed<LegendItem[]>(() => {
    const values = this.roleCounts();
    return this.toLegend(USER_ROLE_CHART_LABELS, values, this.roleTokens);
  });
  roleTotal = computed(() => this.roleLegend().reduce((s, i) => s + i.value, 0));

  // Reads the role-slice (structural equality) so both the legend and the chart
  // only recompute when the role counts actually change.
  private roleCounts(): number[] {
    const byRole = this.roleSlice();
    return [
      byRole[UserRole.ORGANIZER_ADMIN] ?? 0,
      byRole[UserRole.ORGANIZER_USER] ?? 0,
      byRole[UserRole.DISTRIBUTOR] ?? 0,
    ];
  }

  // Builds index-aligned legend rows (label ↔ value ↔ palette token) with each
  // slice's share of the total. Colours use `var(--token)` so DOM swatches stay
  // theme-reactive without a rebuild.
  private toLegend(labels: string[], values: number[], tokens: string[]): LegendItem[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    return labels.map((label, i) => ({
      label,
      value: values[i],
      color: this.varRef(tokens[i]),
      percent: total ? (values[i] / total) * 100 : 0,
    }));
  }

  quickActions = [
    { icon: 'pi pi-calendar-plus', label: 'Create Event', action: () => this.goToCreateEvent() },
    { icon: 'pi pi-user-plus', label: 'Add User', action: () => this.goToCreateUser() },
    { icon: 'pi pi-id-card', label: 'Add Distributor', action: () => this.goToCreateDistributor() },
    { icon: 'pi pi-calendar', label: 'View Events', action: () => this.goToEvents() },
    { icon: 'pi pi-list', label: 'Participants', action: () => this.goToParticipants() },
    { icon: 'pi pi-users', label: 'Manage Users', action: () => this.goToUsers() },
  ];

  // ── Organization profile (header card) ──
  orgInitials = computed(() => {
    const name = this.organization()?.organizerName ?? '';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  });
  orgLocation = computed(() => {
    const org = this.organization();
    return [org?.city, org?.stateProvince, org?.country].filter(Boolean).join(', ');
  });
  planLabel = computed(() => {
    const tier = this.organization()?.subscriptionTier || 'FREE';
    return `${tier.charAt(0).toUpperCase()}${tier.slice(1).toLowerCase()} Plan`;
  });
  memberSince = computed(
    () => this.organization()?.createdAt ?? this.organization()?.subscriptionStartDate ?? null,
  );
  orgIsActive = computed(() => {
    const org = this.organization();
    const status = org?.subscriptionStatus?.toUpperCase();
    return status ? status === 'ACTIVE' : !!org?.enabled;
  });
  orgStatusLabel = computed(
    () => this.organization()?.subscriptionStatus || (this.orgIsActive() ? 'Active' : 'Inactive'),
  );

  // ── Chart options ──
  // Stable references avoid PrimeNG Chart re-painting on every CD cycle (a new
  // `options` object literal reads as a real change). Doughnut and sparkline
  // options are theme-agnostic shared literals; bar options depend on theme
  // tokens, so they use a `computed` that tracks the theme palette.
  readonly doughnutOptions = DASHBOARD_DOUGHNUT_OPTIONS;
  readonly sparklineOptions = DASHBOARD_SPARKLINE_OPTIONS;

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
        y: {
          beginAtZero: true,
          ticks: { color: text, stepSize: 1, precision: 0 },
          grid: { color: border },
        },
      },
    };
  });

  constructor() {
    // Per-chart rebuild effects. Each tracks (theme tokens × its own slice),
    // so a payload swap that doesn't change a slice produces no work for that
    // chart. Theme changes still rebuild everything because canvas can't
    // consume CSS custom properties live.
    effect(() => {
      this.trackTheme();
      this.statusSlice();
      this.rebuildStatusChart();
    });
    effect(() => {
      this.trackTheme();
      this.citySlice();
      this.rebuildCityChart();
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
  }

  private trackTheme(): void {
    this.layout.isDarkTheme();
    this.layout.selectedPrimary();
    this.layout.selectedSurface();
    this.layout.selectedPreset();
  }

  ngOnInit(): void {
    if (!this.user()?.organizationId) {
      this.router.navigate(['/unauthorized']);
      return;
    }
    this.fetch();
    this.fetchRecentActivity();
  }

  private fetchRecentActivity(): void {
    if (this.activityFetchInFlight) return;
    this.activityFetchInFlight = true;
    const isFirstLoad = !this.hasLoadedActivity;
    if (isFirstLoad) this.isLoadingActivity.set(true);
    else this.isRefreshingActivity.set(true);
    this.auditLogService.search({ limit: RECENT_ACTIVITY_LIMIT }).subscribe({
      next: (res) => {
        this.recentActivityRaw.set(res.items ?? []);
        this.hasLoadedActivity = true;
        this.isLoadingActivity.set(false);
        this.isRefreshingActivity.set(false);
        this.activityFetchInFlight = false;
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load recent activity');
        this.hasLoadedActivity = true;
        this.isLoadingActivity.set(false);
        this.isRefreshingActivity.set(false);
        this.activityFetchInFlight = false;
      },
    });
  }

  refreshActivity(): void {
    this.fetchRecentActivity();
  }

  goToAuditLogs(): void {
    this.router.navigate(['/audit-logs']);
  }

  private currentParams(): OrgDashboardParams {
    return {
      range: this.range(),
      statusRange: this.statusRange(),
      citiesRange: this.citiesRange(),
    };
  }

  private fetch(): void {
    if (this.fetchInFlight) return;
    this.fetchInFlight = true;
    // Skeletons only on the very first load. Subsequent dropdown changes keep
    // the existing charts mounted and let the per-slice effects surgically
    // repaint only what actually changed.
    const isFirstLoad = !this.hasLoaded;
    if (isFirstLoad) this.isLoading.set(true);
    this.dashboardService.getOrgDashboard(this.currentParams()).subscribe({
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

  refresh(): void {
    this.isRefreshing.set(true);
    this.dashboardService.refreshOrgDashboard(this.currentParams()).subscribe({
      next: (res) => {
        this.data.set(res);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to refresh dashboard');
        this.isRefreshing.set(false);
      },
    });
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

  private rebuildStatusChart(): void {
    const s = this.statusSlice();
    this.eventStatusChart.set({
      labels: EVENT_STATUS_CHART_LABELS,
      datasets: [
        {
          data: [s.draft, s.published, s.completed, s.cancelled],
          backgroundColor: this.resolve(this.statusTokens),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildRoleChart(): void {
    this.userRoleChart.set({
      labels: USER_ROLE_CHART_LABELS,
      datasets: [
        {
          data: this.roleCounts(),
          backgroundColor: this.resolve(this.roleTokens),
          borderWidth: 0,
        },
      ],
    });
  }

  private rebuildCityChart(): void {
    const byCity = this.citySlice();
    this.eventsByCityChart.set({
      labels: byCity.map((c) => c.city),
      datasets: [
        {
          data: byCity.map((c) => c.count),
          backgroundColor: this.cssVar('--p-primary-400') || '#60a5fa',
          borderRadius: 6,
        },
      ],
    });
  }

  private rebuildSparklines(): void {
    const trends = this.trendsSlice();
    const sparkBorder = this.cssVar('--p-primary-500') || '#6366f1';
    const sparkFill = this.cssVar('--p-primary-100') || '#e0e7ff';
    const labels = trends?.bucketLabels ?? [];
    const buildSpark = (data: number[] | undefined): ChartConfig | null => {
      if (!data || !data.length) return null;
      return {
        labels: labels.length === data.length ? labels : data.map((_, i) => `${i}`),
        datasets: [
          {
            data,
            borderColor: sparkBorder,
            backgroundColor: sparkFill,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      };
    };
    this.sparklines.set({
      events: buildSpark(trends?.series.events),
      active: buildSpark(trends?.series.active),
      users: buildSpark(trends?.series.users),
      cities: buildSpark(trends?.series.cities),
    });
  }

  protected readonly statusSeverity = getEventStatusSeverity;
  protected readonly statusLabel = getEventStatusLabel;

  // ── Theme palette helpers ──
  private readonly statusTokens = EVENT_STATUS_PALETTE_TOKENS;
  private readonly roleTokens = USER_ROLE_PALETTE_TOKENS;

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  private resolve(tokens: string[]): string[] {
    return tokens.map((t) => this.cssVar(t));
  }

  varRef(token: string): string {
    return `var(${token})`;
  }

  // ── Navigation ──
  goToEvents(): void {
    this.router.navigate(['/events']);
  }
  goToCreateEvent(): void {
    this.router.navigate(['/events/new']);
  }
  goToUsers(): void {
    this.router.navigate(['/users']);
  }
  goToCreateUser(): void {
    this.router.navigate(['/users'], { queryParams: { create: 'true' } });
  }
  goToCreateDistributor(): void {
    this.router.navigate(['/users'], {
      queryParams: { create: 'true', createRole: UserRole.DISTRIBUTOR },
    });
  }
  goToParticipants(): void {
    this.router.navigate(['/participants']);
  }
  goToEventDetails(event: EventListItemDto): void {
    this.router.navigate(['/events', event.id]);
  }
}
