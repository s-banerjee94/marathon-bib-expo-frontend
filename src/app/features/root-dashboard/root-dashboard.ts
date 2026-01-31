import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-root-dashboard',
  imports: [CommonModule],
  templateUrl: './root-dashboard.html',
  styleUrl: './root-dashboard.css',
})
export class RootDashboard {
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToCreateOrganization() {
    this.router.navigate(['/manage-organization']);
  }

  goToOrganizationList() {
    this.router.navigate(['/organizations']);
  }

  goToUserList() {
    this.router.navigate(['/users']);
  }

  goToCreateUser() {
    this.router.navigate(['/manage-user']);
  }
}
