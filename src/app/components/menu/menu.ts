import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { AppMenuItem } from '../../shared/models/menu.model';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';
import { MenuitemComponent } from '../menuitem/menuitem';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, MenuitemComponent],
  templateUrl: './menu.html',
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
      label: 'Management',
      icon: 'pi pi-cog',
      roles: [UserRole.ROOT, UserRole.ADMIN],
      items: [
        { label: 'Users', icon: 'pi pi-users', routerLink: '/users' },
        { label: 'Organizations', icon: 'pi pi-building', routerLink: '/organizations' },
      ],
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
  ];

  filteredMenu = computed(() => {
    const userRole = this.authService.getCurrentRole();
    if (!userRole) return [];

    return this.filterMenuByRole(this.menuItems, userRole);
  });

  private filterMenuByRole(items: AppMenuItem[], userRole: UserRole): AppMenuItem[] {
    return items
      .filter((item) => !item.roles || item.roles.includes(userRole))
      .map((item) => ({
        ...item,
        items: item.items ? this.filterMenuByRole(item.items, userRole) : undefined,
      }))
      .filter((item) => !item.items || item.items.length > 0);
  }
}
