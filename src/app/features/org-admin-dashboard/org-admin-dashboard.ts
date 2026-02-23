import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChartModule } from 'primeng/chart';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { EventService } from '../../core/services/event.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { UserStatisticsResponse } from '../../core/models/statistics.model';
import { Organization } from '../../core/models/organization.model';
import { Event, EventStatus } from '../../core/models/event.model';
import { UserRole } from '../../core/models/user.model';
import { RecentEvents } from '../../shared/components/recent-events/recent-events';

interface EventStatusChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    hoverBackgroundColor: string[];
  }[];
}

@Component({
  selector: 'app-org-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ButtonModule,
    CardModule,
    SkeletonModule,
    ProgressBarModule,
    ChartModule,
    DividerModule,
    TagModule,
    TooltipModule,
    RecentEvents,
  ],
  templateUrl: './org-admin-dashboard.html',
  styleUrl: './org-admin-dashboard.css',
})
export class OrgAdminDashboard implements OnInit {
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);
  private eventService = inject(EventService);
  private statisticsService = inject(StatisticsService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

  user = this.authService.currentUser;

  // Data signals
  organization = signal<Organization | null>(null);
  statistics = signal<UserStatisticsResponse | null>(null);
  totalEvents = signal(0);
  activeEvents = signal(0);
  upcomingEvents = signal(0);
  draftEvents = signal(0);
  completedEvents = signal(0);
  cancelledEvents = signal(0);
  recentEvents = signal<Event[]>([]);

  // Computed from statistics (org-scoped)
  totalOrgUsers = computed(() => {
    const byRole = this.statistics()?.users.byRole ?? {};
    return (byRole[UserRole.ORGANIZER_ADMIN] ?? 0) + (byRole[UserRole.ORGANIZER_USER] ?? 0);
  });
  totalDistributors = computed(() => this.statistics()?.users.byRole?.[UserRole.DISTRIBUTOR] ?? 0);
  statsRefreshedAt = computed(() => this.statistics()?.refreshedAt ?? null);

  // Loading signals
  isLoadingOrg = signal(true);
  isLoadingEvents = signal(true);
  isLoadingStats = signal(true);
  isRefreshingStats = signal(false);
  isLoadingRecentEvents = signal(true);

  // Computed capacity
  userCapacityPercent = computed(() => {
    const max = this.organization()?.maxOrganizerUsers || 1;
    return Math.min(Math.round((this.totalOrgUsers() / max) * 100), 100);
  });

  distributorCapacityPercent = computed(() => {
    const max = this.organization()?.maxDistributors || 1;
    return Math.min(Math.round((this.totalDistributors() / max) * 100), 100);
  });

  // Charts
  eventStatusChart = signal<EventStatusChartData | null>(null);
  userRoleChartData = signal<EventStatusChartData | null>(null);

  get chartOptions() {
    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--be-text-color')
      .trim();
    return {
      plugins: { legend: { position: 'bottom' as const, labels: { color: textColor } } },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  ngOnInit(): void {
    if (!this.user()?.organizationId) {
      this.router.navigate(['/unauthorized']);
      return;
    }
    this.loadOrganization();
    this.loadEventStats();
    this.loadStatistics();
    this.loadRecentEvents();
  }

  private loadOrganization(): void {
    this.organizationService.getCurrentUserOrganization().subscribe({
      next: (org) => {
        this.organization.set(org);
        this.isLoadingOrg.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load organization');
        this.isLoadingOrg.set(false);
      },
    });
  }

  private loadStatistics(): void {
    this.isLoadingStats.set(true);
    this.statisticsService.getUserStatistics().subscribe({
      next: (stats) => {
        this.statistics.set(stats);
        this.buildUserRoleChart(stats.users.byRole ?? {});
        this.isLoadingStats.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load user statistics');
        this.isLoadingStats.set(false);
      },
    });
  }

  refreshStats(): void {
    this.isRefreshingStats.set(true);
    forkJoin({
      userStats: this.statisticsService.refreshUserStatistics(),
      eventStats: this.statisticsService.refreshEventStatistics(),
    }).subscribe({
      next: ({ userStats, eventStats }) => {
        this.statistics.set(userStats);
        this.buildUserRoleChart(userStats.users.byRole ?? {});
        this.applyEventStats(eventStats.events.byStatus, eventStats.events.upcoming);
        this.isRefreshingStats.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to refresh statistics');
        this.isRefreshingStats.set(false);
      },
    });
  }

  private loadEventStats(): void {
    this.isLoadingEvents.set(true);
    this.statisticsService.getEventStatistics().subscribe({
      next: (eventStats) => {
        const byStatus = eventStats.events.byStatus;
        this.applyEventStats(byStatus, eventStats.events.upcoming);
        this.totalEvents.set(eventStats.events.total);
        this.isLoadingEvents.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load event statistics');
        this.isLoadingEvents.set(false);
      },
    });
  }

  private buildUserRoleChart(byRole: Record<string, number>): void {
    const ds = getComputedStyle(document.documentElement);
    this.userRoleChartData.set({
      labels: ['Org Admins', 'Org Users', 'Distributors'],
      datasets: [
        {
          data: [
            byRole[UserRole.ORGANIZER_ADMIN] ?? 0,
            byRole[UserRole.ORGANIZER_USER] ?? 0,
            byRole[UserRole.DISTRIBUTOR] ?? 0,
          ],
          backgroundColor: [
            ds.getPropertyValue('--be-cyan-500').trim() || '#06b6d4',
            ds.getPropertyValue('--be-orange-500').trim() || '#f97316',
            ds.getPropertyValue('--be-indigo-500').trim() || '#6366f1',
          ],
          hoverBackgroundColor: [
            ds.getPropertyValue('--be-cyan-400').trim() || '#22d3ee',
            ds.getPropertyValue('--be-orange-400').trim() || '#fb923c',
            ds.getPropertyValue('--be-indigo-400').trim() || '#818cf8',
          ],
        },
      ],
    });
  }

  private applyEventStats(byStatus: Record<string, number>, upcoming: number): void {
    this.activeEvents.set(byStatus[EventStatus.PUBLISHED] ?? 0);
    this.draftEvents.set(byStatus[EventStatus.DRAFT] ?? 0);
    this.completedEvents.set(byStatus[EventStatus.COMPLETED] ?? 0);
    this.cancelledEvents.set(byStatus[EventStatus.CANCELLED] ?? 0);
    this.upcomingEvents.set(upcoming);

    const ds = getComputedStyle(document.documentElement);
    this.eventStatusChart.set({
      labels: ['Published', 'Draft', 'Completed', 'Cancelled'],
      datasets: [
        {
          data: [
            byStatus[EventStatus.PUBLISHED] ?? 0,
            byStatus[EventStatus.DRAFT] ?? 0,
            byStatus[EventStatus.COMPLETED] ?? 0,
            byStatus[EventStatus.CANCELLED] ?? 0,
          ],
          backgroundColor: [
            ds.getPropertyValue('--be-green-500').trim() || '#22c55e',
            ds.getPropertyValue('--be-blue-500').trim() || '#3b82f6',
            ds.getPropertyValue('--be-gray-500').trim() || '#6b7280',
            ds.getPropertyValue('--be-red-500').trim() || '#ef4444',
          ],
          hoverBackgroundColor: [
            ds.getPropertyValue('--be-green-400').trim() || '#4ade80',
            ds.getPropertyValue('--be-blue-400').trim() || '#60a5fa',
            ds.getPropertyValue('--be-gray-400').trim() || '#9ca3af',
            ds.getPropertyValue('--be-red-400').trim() || '#f87171',
          ],
        },
      ],
    });
  }

  private loadRecentEvents(): void {
    this.eventService.searchEvents({ page: 0, size: 5, sort: ['createdAt,desc'] }).subscribe({
      next: (response) => {
        this.recentEvents.set(response.content);
        this.isLoadingRecentEvents.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load recent events');
        this.isLoadingRecentEvents.set(false);
      },
    });
  }

  goToEvents(): void {
    this.router.navigate(['/events']);
  }

  goToCreateEvent(): void {
    this.router.navigate(['/event-form']);
  }

  goToCreateUser(): void {
    this.router.navigate(['/user-form']);
  }

  goToCreateDistributor(): void {
    this.router.navigate(['/user-form'], { queryParams: { role: UserRole.DISTRIBUTOR } });
  }

  goToParticipants(): void {
    this.router.navigate(['/participants']);
  }
}
