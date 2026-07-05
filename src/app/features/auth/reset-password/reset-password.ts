import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';
import { PasswordModule } from 'primeng/password';
import { SkeletonModule } from 'primeng/skeleton';
import { PasswordResetTokenStatus } from '../../../core/models/password-reset.model';
import { PasswordResetService } from '../../../core/services/password-reset.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FORM_INPUT_SIZE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../shared/constants/form.constants';

/**
 * Public, no-auth reset-password page (Page B of the reset flow), reached via
 * the /reset-password?token=… link issued by "forgot password" or an admin.
 * Validates the token on load (greeting the masked username and counting down
 * to expiry), collects the new password, and sends the user to the login page
 * on success — tokens are single-use and never log the user in here.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  host: { class: 'block min-h-screen' },
  imports: [
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    MessageModule,
    FloatLabelModule,
    PasswordModule,
    SkeletonModule,
  ],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private passwordResetService = inject(PasswordResetService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly inputSize = FORM_INPUT_SIZE;

  isLoading = signal(true);
  // Token missing from the URL, rejected by the backend (404), or ran out while open.
  invalidLink = signal(false);
  tokenStatus = signal<PasswordResetTokenStatus | null>(null);
  isSubmitting = signal(false);

  // Seconds until the link expires; drives the countdown chip.
  remainingSeconds = signal(0);
  countdownLabel = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  passwords = { newPassword: '', confirmPassword: '' };

  private token = '';

  get newPasswordValid(): boolean {
    const value = this.passwords.newPassword ?? '';
    return value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;
  }

  get passwordsMatch(): boolean {
    return this.passwords.newPassword === this.passwords.confirmPassword;
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.isLoading.set(false);
      this.invalidLink.set(true);
      return;
    }
    this.passwordResetService.validateToken(this.token).subscribe({
      next: (status) => {
        this.tokenStatus.set(status);
        this.isLoading.set(false);
        this.startCountdown(status.expiresAt);
      },
      error: () => {
        this.invalidLink.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private startCountdown(expiresAt: string): void {
    const expiry = new Date(expiresAt).getTime();
    // A skewed device clock can make a just-validated token look expired —
    // the backend said it's valid, so skip the countdown rather than lie.
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return;
    const tick = (): void => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      this.remainingSeconds.set(remaining);
      // The token died while the page was open — flip to the invalid state so
      // the user doesn't type a password that can only 404.
      if (remaining <= 0 && !this.isSubmitting()) {
        clearInterval(timer);
        this.invalidLink.set(true);
      }
    };
    const timer = setInterval(tick, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    tick();
  }

  onSubmit(form: NgForm): void {
    if (!this.newPasswordValid || !this.passwordsMatch || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.passwordResetService.completeReset(this.token, this.passwords.newPassword).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        form.resetForm();
        this.toast.success('Password updated — please sign in.');
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        // Tokens are single-use: a 404 here means expired or already used.
        if (this.errorHandler.isNotFound(error)) {
          this.invalidLink.set(true);
        } else {
          this.errorHandler.showError(error);
        }
      },
    });
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}
