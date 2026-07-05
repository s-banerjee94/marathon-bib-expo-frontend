import { Component, computed, inject } from '@angular/core';
import { AppMenuItem } from '../../shared/models/menu.model';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { MenuitemComponent } from '../menuitem/menuitem';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MenuitemComponent],
  templateUrl: './menu.html',
  host: { class: 'block h-full' },
})
export class MenuComponent {
  private authService = inject(AuthService);

  private readonly menuItems: AppMenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      routerLink: this.authService.getDashboardRoute(),
      roles: [
        UserRole.ROOT,
        UserRole.ADMIN,
        UserRole.ORGANIZER_ADMIN,
        UserRole.ORGANIZER_USER,
        UserRole.DISTRIBUTOR,
      ],
    },
    {
      label: 'Users',
      icon: 'pi pi-users',
      routerLink: '/users',
      roles: [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER],
    },
    {
      label: 'Organizations',
      icon: 'pi pi-building',
      routerLink: '/organizations',
      roles: [UserRole.ROOT, UserRole.ADMIN],
    },
    {
      label: 'Events',
      icon: 'pi pi-calendar',
      routerLink: '/events',
      roles: [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER],
    },
    {
      label: 'Participants',
      icon: 'pi pi-id-card',
      routerLink: '/participants',
      roles: [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER],
    },
    {
      label: 'Distribution',
      icon: 'pi pi-box',
      routerLink: '/distribution',
    },
    {
      label: 'Billing',
      icon: 'pi pi-receipt',
      routerLink: '/billing',
      roles: [UserRole.ROOT, UserRole.ADMIN],
    },
    {
      label: 'Audit Logs',
      icon: 'pi pi-history',
      routerLink: '/audit-logs',
      roles: [UserRole.ROOT, UserRole.ADMIN, UserRole.ORGANIZER_ADMIN, UserRole.ORGANIZER_USER],
    },
    {
      label: 'System Messaging',
      icon: 'pi pi-megaphone',
      routerLink: '/system-messaging',
      roles: [UserRole.ROOT],
    },
    {
      label: 'Campaign Senders',
      icon: 'pi pi-send',
      routerLink: '/campaign-providers',
      roles: [UserRole.ROOT],
    },
  ];

  // Pinned to the bottom of the sidebar, visually separated from the main nav.
  private readonly bottomMenuItems: AppMenuItem[] = [
    {
      label: 'Organization',
      icon: 'pi pi-building',
      routerLink: '/organization',
      roles: [UserRole.ORGANIZER_ADMIN],
    },
  ];

  filteredMenu = computed(() => {
    const userRole = this.authService.getCurrentRole();
    if (!userRole) return [];
    return this.filterMenu(this.menuItems, userRole);
  });

  filteredBottomMenu = computed(() => {
    const userRole = this.authService.getCurrentRole();
    if (!userRole) return [];
    return this.filterMenu(this.bottomMenuItems, userRole);
  });

  private filterMenu(items: AppMenuItem[], userRole: UserRole): AppMenuItem[] {
    return items.filter((item) => !item.roles || item.roles.includes(userRole));
  }
}
