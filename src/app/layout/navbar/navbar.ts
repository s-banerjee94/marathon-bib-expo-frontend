import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { OverlayBadge } from 'primeng/overlaybadge';
import { PopoverModule } from 'primeng/popover';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeConfigurator } from '../theme-configurator/theme-configurator';
import { ROLE_LABELS } from '../../core/models/user.model';
import { getInitials } from '../../shared/utils/initials.util';

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
    TagModule,
    TooltipModule,
    ThemeConfigurator,
  ],
})
export class Navbar implements OnDestroy {
  layoutService = inject(LayoutService);
  notificationService = inject(NotificationService);

  // Account dropdown: identity header is rendered via the menu's #start template;
  // these are the actionable items below it.
  items: MenuItem[] = [
    { label: 'Profile', icon: 'pi pi-user', command: () => this.onProfile() },
    { separator: true },
    { label: 'Log out', icon: 'pi pi-sign-out', command: () => this.onLogout() },
  ];

  private authService = inject(AuthService);
  private router = inject(Router);
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;
  avatarLabel = computed(() => {
    const user = this.authService.currentUser();
    return getInitials(user?.fullName ?? user?.username);
  });
  // Tracks a profile-picture URL that failed to load, so we fall back to initials
  // (e.g. expired presigned URL). Cleared automatically once the URL changes.
  private failedImageUrl = signal<string | null>(null);
  avatarImage = computed(() => {
    const url = this.authService.currentUser()?.profilePictureUrl;
    const valid = url && url.trim() ? url : undefined;
    return valid && valid !== this.failedImageUrl() ? valid : undefined;
  });
  roleLabel = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? ROLE_LABELS[role] : '';
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

  protected onAvatarImageError(): void {
    this.failedImageUrl.set(this.authService.currentUser()?.profilePictureUrl ?? null);
  }

  protected onProfile(): void {
    this.router.navigate(['/profile']);
  }

  protected onLogout(): void {
    this.authService.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
