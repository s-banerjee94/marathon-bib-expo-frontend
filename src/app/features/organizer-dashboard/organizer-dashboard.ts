import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-organizer-dashboard',
  imports: [CommonModule],
  templateUrl: './organizer-dashboard.html',
  styleUrl: './organizer-dashboard.css',
})
export class OrganizerDashboard {
  private authService = inject(AuthService);
  user = this.authService.currentUser;
  private router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
