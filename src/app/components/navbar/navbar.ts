import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { OverlayBadge } from 'primeng/overlaybadge';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeConfigurator } from '../theme-configurator/theme-configurator';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  imports: [
    DatePipe,
    AvatarModule,
    ButtonModule,
    MenubarModule,
    MenuModule,
    OverlayBadge,
    PopoverModule,
    TooltipModule,
    ThemeConfigurator,
  ],
})
export class Navbar implements OnDestroy {
  layoutService = inject(LayoutService);
  notificationService = inject(NotificationService);

  items: MenuItem[] = [
    { label: 'Profile', command: () => this.onProfile() },
    { label: 'Log out', command: () => this.onLogout() },
  ];

  private authService = inject(AuthService);
  private router = inject(Router);
  isAuthenticated = this.authService.isAuthenticated;
  avatarLabel = computed(() => {
    const user = this.authService.currentUser();
    if (!user?.fullName) return 'U';
    return user.fullName.charAt(0).toUpperCase();
  });

  constructor() {
    effect(() => {
      if (this.isAuthenticated()) {
        this.notificationService.connect();
      } else {
        this.notificationService.disconnect();
      }
    });
  }

  onMenuToggle(event: Event): void {
    event.stopPropagation();
    this.layoutService.onMenuToggle();
  }

  onNotificationRead(id: number, read: boolean): void {
    if (!read) {
      this.notificationService.markAsRead(id);
    }
  }

  ngOnDestroy(): void {
    this.notificationService.disconnect();
  }

  protected onProfile(): void {
    // TODO: navigate to profile
  }

  protected onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
