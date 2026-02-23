import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { EventService } from '../../core/services/event.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import {
  UserStatisticsResponse,
  OrganizationStatisticsResponse,
  EventStatisticsResponse,
} from '../../core/models/statistics.model';
import { UserRole } from '../../core/models/user.model';
import { Organization } from '../../core/models/organization.model';
import { Event } from '../../core/models/event.model';
import { RecentOrganizations } from '../../shared/components/recent-organizations/recent-organizations';
import { RecentEvents } from '../../shared/components/recent-events/recent-events';

interface DoughnutChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    hoverBackgroundColor: string[];
  }[];
}

@Component({
  selector: 'app-root-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    ButtonModule,
    CardModule,
    SkeletonModule,
    ChartModule,
    TooltipModule,
    RecentOrganizations,
    RecentEvents,
  ],
  templateUrl: './root-dashboard.html',
  styleUrl: './root-dashboard.css',
})
export class RootDashboard implements OnInit {
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);
  private eventService = inject(EventService);
  private statisticsService = inject(StatisticsService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

  user = this.authService.currentUser;

  // Statistics snapshots
  statistics = signal<UserStatisticsResponse | null>(null);

  // Computed from user statistics
  totalUsers = computed(() => this.statistics()?.users.total ?? 0);
  activeUsers = computed(() => this.statistics()?.users.active ?? 0);
  disabledUsers = computed(() => this.statistics()?.users.inactive ?? 0);
  totalAdmins = computed(() => this.statistics()?.users.byRole?.[UserRole.ADMIN] ?? 0);
  statsRefreshedAt = computed(() => this.statistics()?.refreshedAt ?? null);

  // Stat signals from org/event statistics
  totalOrganizations = signal(0);
  totalEvents = signal(0);
  activeEvents = signal(0);

  // Loading signals
  isLoadingStats = signal(true);
  isRefreshingStats = signal(false);
  isLoadingRecentOrgs = signal(true);
  isLoadingRecentEvents = signal(true);

  // Recent data signals
  recentOrganizations = signal<Organization[]>([]);
  recentEvents = signal<Event[]>([]);

  // Charts
  roleChartData = signal<DoughnutChartData | null>(null);
  eventStatusChartData = signal<DoughnutChartData | null>(null);
  orgTierChartData = signal<DoughnutChartData | null>(null);
  orgStatusChartData = signal<DoughnutChartData | null>(null);

  get chartOptions() {
    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--be-text-color')
      .trim();
    return {
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { color: textColor },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadRecentOrganizations();
    this.loadRecentEvents();
  }

  private loadStats(): void {
    this.isLoadingStats.set(true);
    forkJoin({
      userStats: this.statisticsService.getUserStatistics(),
      orgStats: this.statisticsService.getOrganizationStatistics(),
      eventStats: this.statisticsService.getEventStatistics(),
    }).subscribe({
      next: ({ userStats, orgStats, eventStats }) => {
        this.statistics.set(userStats);
        this.totalOrganizations.set(orgStats.organizations.total);
        this.totalEvents.set(eventStats.events.total);
        this.activeEvents.set(eventStats.events.upcoming);
        this.buildAllCharts(userStats, orgStats, eventStats);
        this.isLoadingStats.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load dashboard statistics');
        this.isLoadingStats.set(false);
      },
    });
  }

  private buildAllCharts(
    userStats: UserStatisticsResponse,
    orgStats: OrganizationStatisticsResponse,
    eventStats: EventStatisticsResponse,
  ): void {
    const ds = getComputedStyle(document.documentElement);

    // User Role Distribution
    const byRole = userStats.users.byRole ?? {};
    this.roleChartData.set({
      labels: ['Admins', 'Org Admins', 'Org Users', 'Distributors'],
      datasets: [
        {
          data: [
            byRole[UserRole.ADMIN] ?? 0,
            byRole[UserRole.ORGANIZER_ADMIN] ?? 0,
            byRole[UserRole.ORGANIZER_USER] ?? 0,
            byRole[UserRole.DISTRIBUTOR] ?? 0,
          ],
          backgroundColor: [
            ds.getPropertyValue('--be-cyan-500'),
            ds.getPropertyValue('--be-orange-500'),
            ds.getPropertyValue('--be-indigo-500'),
            ds.getPropertyValue('--be-gray-500'),
          ],
          hoverBackgroundColor: [
            ds.getPropertyValue('--be-cyan-400'),
            ds.getPropertyValue('--be-orange-400'),
            ds.getPropertyValue('--be-indigo-400'),
            ds.getPropertyValue('--be-gray-400'),
          ],
        },
      ],
    });

    // Event Status Distribution
    const byStatus = eventStats.events.byStatus ?? {};
    this.eventStatusChartData.set({
      labels: ['Published', 'Draft', 'Completed', 'Cancelled'],
      datasets: [
        {
          data: [
            byStatus['PUBLISHED'] ?? 0,
            byStatus['DRAFT'] ?? 0,
            byStatus['COMPLETED'] ?? 0,
            byStatus['CANCELLED'] ?? 0,
          ],
          backgroundColor: [
            ds.getPropertyValue('--be-green-500').trim() || '#22c55e',
            ds.getPropertyValue('--be-blue-500').trim() || '#3b82f6',
            ds.getPropertyValue('--be-gray-400').trim() || '#9ca3af',
            ds.getPropertyValue('--be-red-500').trim() || '#ef4444',
          ],
          hoverBackgroundColor: [
            ds.getPropertyValue('--be-green-400').trim() || '#4ade80',
            ds.getPropertyValue('--be-blue-400').trim() || '#60a5fa',
            ds.getPropertyValue('--be-gray-300').trim() || '#d1d5db',
            ds.getPropertyValue('--be-red-400').trim() || '#f87171',
          ],
        },
      ],
    });

    // Org by Subscription Tier
    const byTier = orgStats.organizations.bySubscriptionTier ?? {};
    const tierEntries = Object.entries(byTier);
    const tierColors = [
      ds.getPropertyValue('--be-cyan-500').trim() || '#06b6d4',
      ds.getPropertyValue('--be-indigo-500').trim() || '#6366f1',
      ds.getPropertyValue('--be-orange-500').trim() || '#f97316',
      ds.getPropertyValue('--be-green-500').trim() || '#22c55e',
      ds.getPropertyValue('--be-purple-500').trim() || '#a855f7',
    ];
    this.orgTierChartData.set({
      labels: tierEntries.map(([key]) => key),
      datasets: [
        {
          data: tierEntries.map(([, val]) => val),
          backgroundColor: tierEntries.map((_, i) => tierColors[i % tierColors.length]),
          hoverBackgroundColor: tierEntries.map((_, i) => tierColors[i % tierColors.length]),
        },
      ],
    });

    // Org by Subscription Status
    const bySubStatus = orgStats.organizations.bySubscriptionStatus ?? {};
    const subStatusEntries = Object.entries(bySubStatus);
    const subStatusColors = [
      ds.getPropertyValue('--be-green-500').trim() || '#22c55e',
      ds.getPropertyValue('--be-yellow-500').trim() || '#eab308',
      ds.getPropertyValue('--be-red-500').trim() || '#ef4444',
      ds.getPropertyValue('--be-gray-500').trim() || '#6b7280',
    ];
    this.orgStatusChartData.set({
      labels: subStatusEntries.map(([key]) => key),
      datasets: [
        {
          data: subStatusEntries.map(([, val]) => val),
          backgroundColor: subStatusEntries.map(
            (_, i) => subStatusColors[i % subStatusColors.length],
          ),
          hoverBackgroundColor: subStatusEntries.map(
            (_, i) => subStatusColors[i % subStatusColors.length],
          ),
        },
      ],
    });
  }

  refreshStats(): void {
    this.isRefreshingStats.set(true);
    forkJoin({
      userStats: this.statisticsService.refreshUserStatistics(),
      orgStats: this.statisticsService.refreshOrganizationStatistics(),
      eventStats: this.statisticsService.refreshEventStatistics(),
    }).subscribe({
      next: ({ userStats, orgStats, eventStats }) => {
        this.statistics.set(userStats);
        this.totalOrganizations.set(orgStats.organizations.total);
        this.totalEvents.set(eventStats.events.total);
        this.activeEvents.set(eventStats.events.upcoming);
        this.buildAllCharts(userStats, orgStats, eventStats);
        this.isRefreshingStats.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to refresh statistics');
        this.isRefreshingStats.set(false);
      },
    });
  }

  private loadRecentOrganizations(): void {
    this.isLoadingRecentOrgs.set(true);
    this.organizationService
      .searchOrganizations({ page: 0, size: 5, sort: ['createdAt,desc'] })
      .subscribe({
        next: (response) => {
          this.recentOrganizations.set(response.content);
          this.isLoadingRecentOrgs.set(false);
        },
        error: (error) => {
          this.errorHandler.showError(error, 'Failed to load recent organizations');
          this.isLoadingRecentOrgs.set(false);
        },
      });
  }

  private loadRecentEvents(): void {
    this.isLoadingRecentEvents.set(true);
    this.eventService.searchEvents({ page: 0, size: 5, sort: ['createdAt,desc'] }).subscribe({
      next: (response) => {
        this.recentEvents.set(response.content);
        this.isLoadingRecentEvents.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load recent events');
        this.isLoadingRecentEvents.set(false);
      },
    });
  }

  goToUsers(): void {
    this.router.navigate(['/users']);
  }
  goToOrganizations(): void {
    this.router.navigate(['/organizations']);
  }
  goToEvents(): void {
    this.router.navigate(['/events']);
  }
  goToCreateAdmin(): void {
    this.router.navigate(['/user-form'], { queryParams: { role: UserRole.ADMIN } });
  }
  goToCreateOrganization(): void {
    this.router.navigate(['/organization-form']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
