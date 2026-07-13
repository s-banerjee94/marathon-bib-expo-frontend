import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { User } from '../../../core/models/user.model';
import { DeliveryChannel, DeliveryResult } from '../../../core/models/invitation.model';
import { IssueResetLinkRequest } from '../../../core/models/password-reset.model';
import { UserService } from '../../../core/services/user.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  DELIVERY_CHANNEL_META,
  DELIVERY_CHANNEL_OPTIONS,
} from '../../../shared/constants/delivery-channels.constant';
import { canNativeShare, copyToClipboard, shareUrl } from '../../../shared/utils/clipboard.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

/**
 * Send-a-password-reset-link dialog (opened from the Users list row actions).
 * Mirrors the invite-link design: a read-only link field (with copy /
 * native-share) is populated once a link is issued; selecting delivery channels
 * also has the backend send it to the user's own registered phone. The link is
 * single-use and short-lived.
 */
@Component({
  selector: 'app-reset-link-form',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    InputTextModule,
    MessageModule,
    TooltipModule,
  ],
  templateUrl: './reset-link-form.html',
})
export class ResetLinkForm {
  private dialogRef = inject(DynamicDialogRef, { optional: true });
  private dialogConfig = inject(DynamicDialogConfig, { optional: true });
  private userService = inject(UserService);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly canShare = canNativeShare();
  readonly channelOptions = DELIVERY_CHANNEL_OPTIONS;
  readonly channelMeta = DELIVERY_CHANNEL_META;

  /** The user the reset link is for, passed by the opener. */
  readonly user: User | null =
    (this.dialogConfig?.data as { user?: User } | undefined)?.user ?? null;

  // Delivery: empty = manual (just return the URL). The link always goes to the
  // user's own registered phone, so there is no recipient field here.
  selectedChannels = signal<DeliveryChannel[]>([]);
  channelsSelected = computed(() => this.selectedChannels().length > 0);

  isSubmitting = signal(false);
  // The issued link; populated into the always-present read-only field.
  resetUrl = signal<string | null>(null);
  // Per-channel delivery outcome from the response (empty for manual links).
  deliveries = signal<DeliveryResult[]>([]);

  // "Generate link" — just mint a shareable link, no delivery.
  onGenerate(): void {
    this.issue({});
  }

  // "Send" — mint the link and have the backend deliver it to the user's
  // registered phone over the selected channels.
  onSend(): void {
    const channels = this.selectedChannels();
    if (channels.length === 0) {
      this.toast.warn('Select WhatsApp or SMS to send the link.');
      return;
    }
    this.issue({ deliveryChannels: channels });
  }

  private issue(request: IssueResetLinkRequest): void {
    const id = this.user?.id;
    if (id == null) return;

    this.isSubmitting.set(true);
    this.userService.issueResetLink(id, request).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.resetUrl.set(response.resetUrl);
        this.deliveries.set(response.deliveries ?? []);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  async copyLink(): Promise<void> {
    const url = this.resetUrl();
    if (!url) return;
    if (await copyToClipboard(url)) {
      this.toast.success('Reset link copied to clipboard');
    } else {
      this.toast.error('Could not copy the link');
    }
  }

  async shareLink(): Promise<void> {
    const url = this.resetUrl();
    if (!url) return;
    const outcome = await shareUrl({
      title: 'Password reset',
      text: 'Use this link to set a new password',
      url,
    });
    if (outcome === 'failed') await this.copyLink();
  }

  close(): void {
    this.dialogRef?.close();
  }
}
