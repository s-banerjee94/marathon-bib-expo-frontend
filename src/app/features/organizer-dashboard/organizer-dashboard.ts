import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from '../../core/services/organization.service';
import { EventService } from '../../core/services/event.service';
import { UserService } from '../../core/services/user.service';
import { Organization } from '../../core/models/organization.model';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-organizer-dashboard',
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    SkeletonModule,
    ProgressBarModule,
    MessageModule,
  ],
  templateUrl: './organizer-dashboard.html',
  styleUrl: './organizer-dashboard.css',
})
export class OrganizerDashboard implements OnInit {
  private authService = inject(AuthService);
  private organizationService = inject(OrganizationService);
  private eventService = inject(EventService);
  private userService = inject(UserService);
  private router = inject(Router);

  // Auth and role
  user = this.authService.currentUser;
  isOrgAdmin = computed(() => this.user()?.role === UserRole.ORGANIZER_ADMIN);

  // Organization data
  organization = signal<Organization | null>(null);
  isLoadingOrg = signal(true);

  // Event statistics
  totalEvents = signal(0);
  activeEvents = signal(0);
  upcomingEvents = signal(0);
  isLoadingEvents = signal(true);

  // User counts
  totalOrgUsers = signal(0);
  totalDistributors = signal(0);
  isLoadingUsers = signal(true);

  // Computed properties
  userCapacityPercentage = computed(() => {
    const max = this.organization()?.maxOrganizerUsers || 1;
    return Math.round((this.totalOrgUsers() / max) * 100);
  });

  distributorCapacityPercentage = computed(() => {
    const max = this.organization()?.maxDistributors || 1;
    return Math.round((this.totalDistributors() / max) * 100);
  });

  userCapacityClass = computed(() => {
    const percentage = this.userCapacityPercentage();
    if (percentage >= 100) return 'capacity-full';
    if (percentage >= 80) return 'capacity-warning';
    return 'capacity-good';
  });

  distributorCapacityClass = computed(() => {
    const percentage = this.distributorCapacityPercentage();
    if (percentage >= 100) return 'capacity-full';
    if (percentage >= 80) return 'capacity-warning';
    return 'capacity-good';
  });

  ngOnInit(): void {
    // Check if user has organizationId
    if (!this.user()?.organizationId) {
      console.error('User does not have an organizationId assigned');
      this.router.navigate(['/unauthorized']);
      return;
    }

    this.loadOrganizationDetails();
    this.loadEventStatistics();
    this.loadUserCounts();
  }

  private loadOrganizationDetails(): void {
    this.isLoadingOrg.set(true);
    this.organizationService.getCurrentUserOrganization().subscribe({
      next: (org) => {
        this.organization.set(org);
        this.isLoadingOrg.set(false);
      },
      error: (error) => {
        console.error('Failed to load organization details', error);
        this.isLoadingOrg.set(false);
      },
    });
  }

  private loadEventStatistics(): void {
    this.isLoadingEvents.set(true);
    // EventService automatically scopes to user's organization
    this.eventService.searchEvents({ page: 0, size: 1000 }).subscribe({
      next: (response) => {
        const events = response.content;
        const now = new Date();

        this.totalEvents.set(response.totalElements);
        this.activeEvents.set(events.filter((e) => e.status === 'PUBLISHED').length);
        this.upcomingEvents.set(
          events.filter((e) => e.eventStartDate && new Date(e.eventStartDate) > now).length,
        );
        this.isLoadingEvents.set(false);
      },
      error: (error) => {
        console.error('Failed to load event statistics', error);
        this.isLoadingEvents.set(false);
      },
    });
  }

  private loadUserCounts(): void {
    this.isLoadingUsers.set(true);

    forkJoin({
      orgUsers: this.userService.getOrganizationUsers({ role: UserRole.ORGANIZER_USER }),
      orgAdmins: this.userService.getOrganizationUsers({ role: UserRole.ORGANIZER_ADMIN }),
      distributors: this.userService.getOrganizationUsers({ role: UserRole.DISTRIBUTOR }),
    }).subscribe({
      next: ({ orgUsers, orgAdmins, distributors }) => {
        // Count array lengths since endpoint returns a simple list
        const orgUserCount = orgUsers.length;
        const orgAdminCount = orgAdmins.length;
        const distributorCount = distributors.length;

        console.log('User counts:', { orgUserCount, orgAdminCount, distributorCount });

        // Total org users includes both ORGANIZER_USER and ORGANIZER_ADMIN
        this.totalOrgUsers.set(orgUserCount + orgAdminCount);
        this.totalDistributors.set(distributorCount);
        this.isLoadingUsers.set(false);
      },
      error: (error) => {
        console.error('Failed to load user counts', error);
        this.isLoadingUsers.set(false);
      },
    });
  }

  // Navigation methods
  goToEvents(): void {
    this.router.navigate(['/events']);
  }

  goToCreateEvent(): void {
    this.router.navigate(['/event-form']);
  }

  goToUsers(): void {
    const orgId = this.user()?.organizationId;
    this.router.navigate(['/users'], {
      queryParams: orgId ? { organizationId: orgId } : {},
    });
  }

  goToCreateUser(): void {
    this.router.navigate(['/user-form']);
  }

  goToCreateDistributor(): void {
    this.router.navigate(['/user-form'], {
      queryParams: { role: UserRole.DISTRIBUTOR },
    });
  }

  goToParticipants(): void {
    this.router.navigate(['/participants']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
