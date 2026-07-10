import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  NgZone,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { OverlayBadge } from 'primeng/overlaybadge';
import { PopoverModule } from 'primeng/popover';
import { TagModule } from 'primeng/tag';
import type { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { NotificationService } from '../../core/services/notification.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { CommandPaletteService } from '../../core/services/command-palette.service';
import { ThemeConfigurator } from '../theme-configurator/theme-configurator';
import { NotificationCard } from '../../features/notifications/notification-card/notification-card';
import { NotificationCardSkeleton } from '../../features/notifications/notification-card-skeleton/notification-card-skeleton';
import { EmptyIllustration } from '../../shared/illustrations/empty-illustration';
import { ROLE_LABELS } from '../../core/models/user.model';
import { getInitials } from '../../shared/utils/initials.util';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  imports: [
    RouterLink,
    AvatarModule,
    ButtonModule,
    MenubarModule,
    MenuModule,
    OverlayBadge,
    PopoverModule,
    TagModule,
    ThemeConfigurator,
    NotificationCard,
    NotificationCardSkeleton,
    EmptyIllustration,
  ],
})
export class Navbar implements OnDestroy {
  layoutService = inject(LayoutService);
  notificationService = inject(NotificationService);
  aiAssistant = inject(AiAssistantService);
  commandPalette = inject(CommandPaletteService);
  // Drives the landing vs. app-shell variants of the topbar.
  isLandingRoute = this.layoutService.isLandingRoute;

  // Landing in-page nav — hash anchors, so routerLinkActive can't track them;
  // a scroll listener marks the section currently under the topbar instead.
  protected readonly landingSections = [
    { id: 'features', label: 'Features' },
    { id: 'how', label: 'How it works' },
    { id: 'roles', label: 'Roles' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'faq', label: 'FAQ' },
  ] as const;
  protected readonly activeSection = signal('');

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

    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        let ticking = false;
        const update = (): void => {
          ticking = false;
          if (!this.isLandingRoute()) {
            return;
          }
          let current = '';
          for (const { id } of this.landingSections) {
            const el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top <= 120) {
              current = id;
            }
          }
          if (current !== this.activeSection()) {
            zone.run(() => this.activeSection.set(current));
          }
        };
        const onScroll = (): void => {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
          }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
      });
    });
  }

  onMenuToggle(event: Event): void {
    event.stopPropagation();
    this.layoutService.onMenuToggle();
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

  protected viewAllNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  protected onLogout(): void {
    this.authService.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
