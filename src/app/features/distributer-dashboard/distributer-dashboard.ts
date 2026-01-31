import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-distributer-dashboard',
  imports: [CommonModule],
  templateUrl: './distributer-dashboard.html',
  styleUrl: './distributer-dashboard.css',
})
export class DistributerDashboard {
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
