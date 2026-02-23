import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { DividerModule } from 'primeng/divider';
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

interface DoughnutChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    hoverBackgroundColor: string[];
  }[];
}

@Component({
  selector: 'app-org-user-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ButtonModule,
    CardModule,
    SkeletonModule,
    TagModule,
    ChartModule,
    ProgressBarModule,
    DividerModule,
    TooltipModule,
    RecentEvents,
  ],
  templateUrl: './org-user-dashboard.html',
  styleUrl: './org-user-dashboard.css',
})
export class OrgUserDashboard implements OnInit {
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

  // Event stat signals
  totalEvents = signal(0);
  activeEvents = signal(0);
  upcomingEvents = signal(0);
  completedEvents = signal(0);
  cancelledEvents = signal(0);
  draftEvents = signal(0);

  recentEvents = signal<Event[]>([]);

  // Charts
  eventStatusChart = signal<DoughnutChartData | null>(null);
  userRoleChart = signal<DoughnutChartData | null>(null);

  // Computed from user statistics (org-scoped)
  totalOrgUsers = computed(() => {
    const byRole = this.statistics()?.users.byRole ?? {};
    return (byRole[UserRole.ORGANIZER_ADMIN] ?? 0) + (byRole[UserRole.ORGANIZER_USER] ?? 0);
  });
  totalDistributors = computed(() => this.statistics()?.users.byRole?.[UserRole.DISTRIBUTOR] ?? 0);
  activeOrgUsers = computed(() => this.statistics()?.users.active ?? 0);
  inactiveOrgUsers = computed(() => this.statistics()?.users.inactive ?? 0);
  statsRefreshedAt = computed(() => this.statistics()?.refreshedAt ?? null);

  // Capacity computed from org limits
  userCapacityPercent = computed(() => {
    const max = this.organization()?.maxOrganizerUsers || 1;
    return Math.min(Math.round((this.totalOrgUsers() / max) * 100), 100);
  });
  distributorCapacityPercent = computed(() => {
    const max = this.organization()?.maxDistributors || 1;
    return Math.min(Math.round((this.totalDistributors() / max) * 100), 100);
  });

  // Loading signals
  isLoadingOrg = signal(true);
  isLoadingStats = signal(true);
  isLoadingRecentEvents = signal(true);

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
    this.loadStats();
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

  private loadStats(): void {
    this.isLoadingStats.set(true);
    forkJoin({
      userStats: this.statisticsService.getUserStatistics(),
      eventStats: this.statisticsService.getEventStatistics(),
    }).subscribe({
      next: ({ userStats, eventStats }) => {
        this.statistics.set(userStats);

        const byStatus = eventStats.events.byStatus;
        this.totalEvents.set(eventStats.events.total);
        this.activeEvents.set(byStatus[EventStatus.PUBLISHED] ?? 0);
        this.upcomingEvents.set(eventStats.events.upcoming);
        this.completedEvents.set(byStatus[EventStatus.COMPLETED] ?? 0);
        this.cancelledEvents.set(byStatus[EventStatus.CANCELLED] ?? 0);
        this.draftEvents.set(byStatus[EventStatus.DRAFT] ?? 0);

        this.buildCharts(userStats, byStatus, eventStats.events.upcoming);
        this.isLoadingStats.set(false);
      },
      error: (err) => {
        this.errorHandler.showError(err, 'Failed to load statistics');
        this.isLoadingStats.set(false);
      },
    });
  }

  private buildCharts(
    userStats: UserStatisticsResponse,
    byStatus: Record<string, number>,
    upcoming: number,
  ): void {
    const ds = getComputedStyle(document.documentElement);

    // Event Status Distribution
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

    // Team Role Distribution
    const byRole = userStats.users.byRole ?? {};
    this.userRoleChart.set({
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

  cityLine(org: Organization): string {
    return [org.city, org.stateProvince, org.postalCode].filter(Boolean).join(', ');
  }

  goToEvents(): void {
    this.router.navigate(['/events']);
  }

  goToCreateEvent(): void {
    this.router.navigate(['/event-form']);
  }

  goToParticipants(): void {
    this.router.navigate(['/participants']);
  }
}
