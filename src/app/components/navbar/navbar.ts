import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { ThemeConfigurator } from '../theme-configurator/theme-configurator';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    AvatarModule,
    ButtonModule,
    MenubarModule,
    MenuModule,
    PopoverModule,
    TooltipModule,
    ThemeConfigurator,
  ],
  templateUrl: './navbar.html',
})
export class Navbar {
  layoutService = inject(LayoutService);
  items: MenuItem[] = [
    { label: 'Profile', command: () => this.onProfile() },
    { label: 'Log out', command: () => this.onLogout() },
  ];
  private authService = inject(AuthService);
  isAuthenticated = this.authService.isAuthenticated;

  onMenuToggle(event: Event): void {
    event.stopPropagation();
    this.layoutService.onMenuToggle();
  }

  protected onProfile(): void {
    // TODO: navigate to profile
  }

  protected onLogout(): void {
    // TODO: call AuthService.logout()
  }
}
