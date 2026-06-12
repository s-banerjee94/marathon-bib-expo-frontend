import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import {
  AcceptInvitationRequest,
  InvitationDetailsResponse,
} from '../../core/models/invitation.model';
import { ROLE_LABELS, UserRole } from '../../core/models/user.model';
import { InvitationService } from '../../core/services/invitation.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { ToastService } from '../../core/services/toast.service';
import { shouldShowError } from '../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../shared/constants/form.constants';

/**
 * Public, no-auth account-creation page reached from an invite link
 * (/accept-invite?token=…). It reads the invite's fixed role/org to render the
 * form, then the invitee sets their own username/password and contact details.
 * Renders bare (no app shell). The link is consumed only on success, so a 409
 * (taken username/email/phone) or 400 can be corrected and retried.
 */
@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  host: { class: 'block min-h-screen' },
  imports: [
    DatePipe,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    FloatLabelModule,
    TagModule,
    SkeletonModule,
  ],
  templateUrl: './accept-invitation.html',
  styleUrl: './accept-invitation.css',
})
export class AcceptInvitation implements OnInit {
  private invitationService = inject(InvitationService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly roleLabels = ROLE_LABELS;
  shouldShowError = shouldShowError;

  isLoading = signal(true);
  // Invite token couldn't be read, or the link is invalid/expired (404).
  invalidLink = signal(false);
  details = signal<InvitationDetailsResponse | null>(null);
  isSubmitting = signal(false);

  private token = '';

  form: AcceptInvitationRequest = {
    username: '',
    password: '',
    fullName: '',
    email: '',
    phoneNumber: '',
  };

  // Email and phone are required for every role except DISTRIBUTOR (mirrors the backend).
  contactRequired = computed(() => this.details()?.role !== UserRole.DISTRIBUTOR);

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token') ?? '';
    if (!this.token) {
      this.isLoading.set(false);
      this.invalidLink.set(true);
      return;
    }
    this.loadInvitation();
  }

  private loadInvitation(): void {
    this.invitationService.getInvitation(this.token).subscribe({
      next: (details) => {
        this.details.set(details);
        // When the invite was sent to a phone, pre-fill it so the invitee
        // doesn't retype the number the link was delivered to.
        if (details.recipientPhone) {
          this.form.phoneNumber = details.recipientPhone;
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.invalidLink.set(true);
        this.isLoading.set(false);
      },
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    const request: AcceptInvitationRequest = {
      username: this.form.username,
      password: this.form.password,
      fullName: this.form.fullName,
    };
    // Contact details are optional for DISTRIBUTOR; send them only when provided.
    if (this.form.email?.trim()) request.email = this.form.email.trim();
    if (this.form.phoneNumber?.trim()) request.phoneNumber = this.form.phoneNumber.trim();

    this.isSubmitting.set(true);
    this.invitationService.acceptInvitation(this.token, request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.success('Account created. Please sign in to continue.', 'Welcome');
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        // The link stays live on recoverable failures (e.g. a taken username), so
        // the invitee can fix the details and submit again.
        this.errorHandler.showError(error);
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
