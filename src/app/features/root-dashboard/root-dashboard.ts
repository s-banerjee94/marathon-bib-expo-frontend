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
  user = this.authService.currentUser;
  private router = inject(Router);

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
