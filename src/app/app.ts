import { Component, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Navbar } from './layout/navbar/navbar';
import { SidebarComponent } from './layout/sidebar/sidebar';
import { LayoutService } from './core/services/layout.service';
import { AuthService } from './core/services/auth.service';
import { AiAssistantService } from './core/services/ai-assistant.service';
import { AiAssistant } from './layout/ai-assistant/ai-assistant';
import { ImportProgressFloating } from './layout/import-progress-floating/import-progress-floating';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    Navbar,
    SidebarComponent,
    ToastModule,
    ConfirmDialogModule,
    ImportProgressFloating,
    AiAssistant,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  protected aiAssistant = inject(AiAssistantService);
  private router = inject(Router);
  isAuthenticated = this.authService.isAuthenticated;

  // Public routes (e.g. /s/:shortCode) render bare — no navbar, sidebar, or layout chrome.
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  isPublicRoute = computed(() => {
    const url = this.currentUrl().split('?')[0];
    return url === '/s' || url.startsWith('/s/') || url === '/accept-invite';
  });

  layoutClasses = computed(() => {
    const config = this.layoutService.layoutConfig();
    const state = this.layoutService.layoutState();

    return {
      'layout-static': config.menuMode === 'static',
      'layout-overlay': config.menuMode === 'overlay',
      'layout-static-inactive': state.staticMenuDesktopInactive && config.menuMode === 'static',
      'layout-mobile-active': state.mobileMenuActive,
      'layout-overlay-active': state.overlayMenuActive,
      'layout-ai-push': config.aiAssistantMode === 'push' && this.aiAssistant.isOpen(),
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
