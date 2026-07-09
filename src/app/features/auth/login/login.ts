import { Component, computed, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

interface FeatureHighlight {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    PasswordModule,
    MessageModule,
  ],
  templateUrl: './login.html',
})
export class Login implements OnInit, OnDestroy {
  // Signals for reactive state
  username = signal('');
  password = signal('');
  errorMessage = signal('');
  // Computed signal for form validity
  isFormValid = computed(() => this.username().trim() !== '' && this.password().trim() !== '');
  // Form input size (controlled centrally via constant)
  readonly inputSize = FORM_INPUT_SIZE;

  // Branding panel feature highlights — mirror the app's core workflows.
  readonly features: readonly FeatureHighlight[] = [
    {
      icon: 'pi pi-users',
      title: 'Participant Management',
      description: 'Organize and track every runner with ease.',
    },
    {
      icon: 'pi pi-tag',
      title: 'Bib & Kit Distribution',
      description: 'Assign bibs and manage kit handouts at the expo.',
    },
    {
      icon: 'pi pi-chart-bar',
      title: 'Real-time Insights',
      description: 'Live dashboards and reports at your fingertips.',
    },
  ];

  private readonly authService = inject(AuthService);
  // Access loading state from auth service
  isLoading = this.authService.isLoading;
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  // Whether we forced dark mode for this screen (so we only undo our own change).
  private pinnedDark = false;

  // The login screen is always presented in the dark "noir" palette to match the
  // brand design, regardless of the user's saved theme. Pin `app-dark` on the
  // document root (PrimeNG scopes its dark tokens there) and restore on leave.
  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const root = this.document.documentElement;
    if (!root.classList.contains('app-dark')) {
      root.classList.add('app-dark');
      this.pinnedDark = true;
    }
  }

  ngOnDestroy(): void {
    if (this.pinnedDark) {
      this.document.documentElement.classList.remove('app-dark');
    }
  }

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
          const route = this.authService.getDashboardRoute();
          this.router.navigate([route]);
        },
        error: (err: Error) => {
          const message = err.message || 'Login failed. Please try again.';
          this.errorMessage.set(message);
        },
      });
  }

  onForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}
