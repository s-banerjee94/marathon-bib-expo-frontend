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
  user = this.authService.currentUser;
  private router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
