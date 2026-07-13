import { Component, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastOutlet } from './layout/toast-outlet/toast-outlet';
import { Navbar } from './layout/navbar/navbar';
import { OfflineBanner } from './layout/offline-banner/offline-banner';
import { SidebarComponent } from './layout/sidebar/sidebar';
import { LayoutService } from './core/services/layout.service';
import { AuthService } from './core/services/auth.service';
import { ConnectivityService } from './core/services/connectivity.service';
import { AiAssistantService } from './core/services/ai-assistant.service';
import { AiAssistant } from './layout/ai-assistant/ai-assistant';
import { CommandPalette } from './layout/command-palette/command-palette';
import { KeyboardShortcutsHelp } from './layout/keyboard-shortcuts-help/keyboard-shortcuts-help';
import { KeyboardService } from './core/services/keyboard.service';
import { ImportProgressFloating } from './layout/import-progress-floating/import-progress-floating';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    Navbar,
    OfflineBanner,
    SidebarComponent,
    ToastOutlet,
    ConfirmDialogModule,
    ImportProgressFloating,
    AiAssistant,
    CommandPalette,
    KeyboardShortcutsHelp,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  protected aiAssistant = inject(AiAssistantService);
  private connectivity = inject(ConnectivityService);
  // Instantiated app-load so its document-level keydown listener is attached;
  // the service itself gates on auth before acting.
  private keyboard = inject(KeyboardService);
  isAuthenticated = this.authService.isAuthenticated;
  // Route classification is owned centrally by LayoutService (single source of
  // truth for the router URL), so the navbar/shell can't drift out of sync.
  isLanding = this.layoutService.isLandingRoute;
  // Bare routes (login + public links like /s/:shortCode) render with no navbar,
  // sidebar, or layout chrome — just the routed page filling the viewport.
  isPublicRoute = this.layoutService.isPublicRoute;

  // Sidebar + static-menu offsets only belong to the authenticated app pages,
  // never the public landing (which an authenticated user may also view).
  showSidebar = computed(() => this.isAuthenticated() && !this.isLanding());
  // The landing is full-bleed; app pages get the standard content padding.
  contentClass = computed(() => (this.isLanding() ? '' : 'p-3 sm:p-4 md:p-5'));

  layoutClasses = computed(() => {
    if (this.isLanding()) {
      return {};
    }

    const config = this.layoutService.layoutConfig();
    const state = this.layoutService.layoutState();

    return {
      'layout-static': config.menuMode === 'static',
      'layout-overlay': config.menuMode === 'overlay',
      'layout-static-inactive': state.staticMenuDesktopInactive && config.menuMode === 'static',
      'layout-static-collapsed': config.sidebarCollapsed && config.menuMode === 'static',
      'layout-mobile-active': state.mobileMenuActive,
      'layout-overlay-active': state.overlayMenuActive,
      'layout-ai-push': config.aiAssistantMode === 'push' && this.aiAssistant.isOpen(),
      // Offline banner sits above the topbar; this offsets the topbar/sidebar/main down.
      'offline-active': !this.connectivity.isOnline(),
    };
  });
  private platformId = inject(PLATFORM_ID);

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;

      const state = this.layoutService.layoutState();
      if (state.mobileMenuActive || state.overlayMenuActive) {
        document.body.classList.add('blocked-scroll');
      } else {
        document.body.classList.remove('blocked-scroll');
      }
    });
  }

  onMaskClick(): void {
    this.layoutService.hideMenu();
  }
}
