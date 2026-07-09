import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';
import { PasswordResetService } from '../../../core/services/password-reset.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

// Client-side rate limit between requests (the backend response is identical
// whether or not the account exists, so this is the only send brake).
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Public, no-auth "forgot password" page (Page A of the reset flow), linked
 * from the login screen. Collects a username/email/phone and asks the backend
 * to send a reset link to the account's registered phone. The confirmation is
 * always the same generic message — account existence is never revealed.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  host: { class: 'block min-h-screen' },
  imports: [
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    FloatLabelModule,
  ],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private passwordResetService = inject(PasswordResetService);
  private errorHandler = inject(ErrorHandlerService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;

  identifier = '';
  isSubmitting = signal(false);
  // A request went through at least once — switches the card to the "sent" state.
  requestSent = signal(false);
  // Seconds until the button can be used again (0 = ready).
  cooldown = signal(0);

  onSubmit(form: NgForm): void {
    if (form.invalid || this.isSubmitting() || this.cooldown() > 0) return;

    this.isSubmitting.set(true);
    this.passwordResetService.requestResetLink({ identifier: this.identifier.trim() }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.requestSent.set(true);
        this.startCooldown();
      },
      error: (error) => {
        this.isSubmitting.set(false);
        // Only a blank identifier can 400 here; the response never reveals accounts.
        this.errorHandler.showError(error);
      },
    });
  }

  private startCooldown(): void {
    this.cooldown.set(RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(next);
      if (next <= 0) clearInterval(timer);
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
