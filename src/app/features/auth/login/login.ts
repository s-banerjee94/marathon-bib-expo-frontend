import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, InputTextModule, ButtonModule, PasswordModule, CardModule, MessageModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Signals for reactive state
  username = signal('');
  password = signal('');
  errorMessage = signal('');

  // Computed signal for form validity
  isFormValid = computed(() => this.username().trim() !== '' && this.password().trim() !== '');

  // Access loading state from auth service
  isLoading = this.authService.isLoading;

  private readonly roleRoutes: Record<string, string> = {
    ROOT: '/root-dashboard',
    ADMIN: '/admin-dashboard',
    ORGANIZER_ADMIN: '/organizer-dashboard',
    ORGANIZER_USER: '/organizer-dashboard',
    DISTRIBUTOR: '/distributer-dashboard',
  };

  onLogin(): void {
    this.errorMessage.set('');

    if (!this.isFormValid()) {
      this.errorMessage.set('Please enter username and password');
      return;
    }

    this.authService
      .login({
        username: this.username(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          const userRole = this.authService.getCurrentRole();
          const route = userRole
            ? (this.roleRoutes[userRole] ?? '/root-dashboard')
            : '/root-dashboard';

          this.router.navigate([route]);
        },
        error: (err: Error) => {
          const message = err.message || 'Login failed. Please try again.';
          this.errorMessage.set(message);
        },
      });
  }
}
