import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import type { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, MenubarModule, AvatarModule, MenuModule],
  templateUrl: './navbar.html',
})
export class Navbar {
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
}
