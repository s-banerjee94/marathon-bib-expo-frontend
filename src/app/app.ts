import { Component, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Navbar } from './layout/navbar/navbar';
import { SidebarComponent } from './layout/sidebar/sidebar';
import { LayoutService } from './core/services/layout.service';
import { AuthService } from './core/services/auth.service';
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
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  isAuthenticated = this.authService.isAuthenticated;
  layoutClasses = computed(() => {
    const config = this.layoutService.layoutConfig();
    const state = this.layoutService.layoutState();

    return {
      'layout-static': config.menuMode === 'static',
      'layout-overlay': config.menuMode === 'overlay',
      'layout-static-inactive': state.staticMenuDesktopInactive && config.menuMode === 'static',
      'layout-mobile-active': state.mobileMenuActive,
      'layout-overlay-active': state.overlayMenuActive,
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
