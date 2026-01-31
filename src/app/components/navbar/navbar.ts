import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { StyleClassModule } from 'primeng/styleclass';
import type { MenuItem } from 'primeng/api';
import { LayoutService } from '../../core/services/layout.service';
import { ThemeConfigurator } from '../theme-configurator/theme-configurator';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MenubarModule,
    AvatarModule,
    MenuModule,
    StyleClassModule,
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

  protected onProfile(): void {
    // TODO: navigate to profile
  }

  protected onLogout(): void {
    // TODO: call AuthService.logout()
  }

  toggleDarkMode(): void {
    this.layoutService.layoutConfig.update((state) => ({
      ...state,
      darkTheme: !state.darkTheme,
    }));
  }
}
