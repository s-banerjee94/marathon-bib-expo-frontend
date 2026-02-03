import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToCreateOrganization() {
    this.router.navigate(['/organization-form']);
  }

  goToOrganizationList() {
    this.router.navigate(['/organizations']);
  }

  goToUserList() {
    this.router.navigate(['/users']);
  }

  goToCreateUser() {
    this.router.navigate(['/user-form']);
  }
}
