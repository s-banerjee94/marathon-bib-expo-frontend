import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { OrganizationService } from '../../core/services/organization.service';
import { EventService } from '../../core/services/event.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { UserRole } from '../../core/models/user.model';
import { Organization } from '../../core/models/organization.model';
import { Event, EventStatus } from '../../core/models/event.model';
import { RecentOrganizations } from '../../shared/components/recent-organizations/recent-organizations';
import { RecentEvents } from '../../shared/components/recent-events/recent-events';

interface RoleChartData {
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
    ButtonModule,
    CardModule,
    SkeletonModule,
    ChartModule,
    RecentOrganizations,
    RecentEvents,
  ],
  templateUrl: './root-dashboard.html',
  styleUrl: './root-dashboard.css',
})
export class RootDashboard implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private organizationService = inject(OrganizationService);
  private eventService = inject(EventService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);

  user = this.authService.currentUser;

  // Stat signals
  totalUsers = signal(0);
  totalOrganizations = signal(0);
  totalEvents = signal(0);
  activeEvents = signal(0);
  totalAdmins = signal(0);
  disabledUsers = signal(0);

  // Loading signals
  isLoadingStats = signal(true);
  isLoadingRoleChart = signal(true);
  isLoadingRecentOrgs = signal(true);
  isLoadingRecentEvents = signal(true);

  // Recent data signals
  recentOrganizations = signal<Organization[]>([]);
  recentEvents = signal<Event[]>([]);

  // Chart
  roleChartData = signal<RoleChartData | null>(null);
  get roleChartOptions() {
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
    this.loadRoleDistribution();
    this.loadRecentOrganizations();
    this.loadRecentEvents();
  }

  private loadStats(): void {
    this.isLoadingStats.set(true);
    forkJoin({
      users: this.userService.searchUsers({ page: 0, size: 1 }),
      organizations: this.organizationService.searchOrganizations({ page: 0, size: 1 }),
      events: this.eventService.searchEvents({ page: 0, size: 1 }),
      activeEvents: this.eventService.searchEvents({
        page: 0,
        size: 1,
        status: EventStatus.PUBLISHED,
      }),
      disabledUsers: this.userService.searchUsers({ page: 0, size: 1, enabled: false }),
      admins: this.userService.searchUsers({ page: 0, size: 1, role: UserRole.ADMIN }),
    }).subscribe({
      next: ({ users, organizations, events, activeEvents, disabledUsers, admins }) => {
        this.totalUsers.set(users.totalElements);
        this.totalOrganizations.set(organizations.totalElements);
        this.totalEvents.set(events.totalElements);
        this.activeEvents.set(activeEvents.totalElements);
        this.disabledUsers.set(disabledUsers.totalElements);
        this.totalAdmins.set(admins.totalElements);
        this.isLoadingStats.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load dashboard statistics');
        this.isLoadingStats.set(false);
      },
    });
  }

  private loadRoleDistribution(): void {
    this.isLoadingRoleChart.set(true);
    forkJoin({
      admins: this.userService.searchUsers({ page: 0, size: 1, role: UserRole.ADMIN }),
      orgAdmins: this.userService.searchUsers({ page: 0, size: 1, role: UserRole.ORGANIZER_ADMIN }),
      orgUsers: this.userService.searchUsers({ page: 0, size: 1, role: UserRole.ORGANIZER_USER }),
      distributors: this.userService.searchUsers({ page: 0, size: 1, role: UserRole.DISTRIBUTOR }),
    }).subscribe({
      next: ({ admins, orgAdmins, orgUsers, distributors }) => {
        const ds = getComputedStyle(document.documentElement);
        this.roleChartData.set({
          labels: ['Admins', 'Org Admins', 'Org Users', 'Distributors'],
          datasets: [
            {
              data: [
                admins.totalElements,
                orgAdmins.totalElements,
                orgUsers.totalElements,
                distributors.totalElements,
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
        this.isLoadingRoleChart.set(false);
      },
      error: (error) => {
        this.errorHandler.showError(error, 'Failed to load role distribution');
        this.isLoadingRoleChart.set(false);
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

  // Navigation
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
