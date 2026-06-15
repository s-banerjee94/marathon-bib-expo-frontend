import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageModule } from 'primeng/message';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { CampaignProviderService } from '../../../core/services/campaign-provider.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MessagingChannel,
  MessagingProviderResponse,
  SaveMessagingProviderRequest,
} from '../../../core/models/system-messaging.model';
import { CampaignProviderScope } from '../../../core/models/campaign-provider.model';
import { CHANNEL_DEFAULT_TEMPLATE_MODE } from '../../system-messaging/system-messaging.constants';
import { ProviderConnectionForm } from '../../system-messaging/provider-connection-form/provider-connection-form';
import { CampaignProviderTestDialog } from '../campaign-provider-test-dialog/campaign-provider-test-dialog';

// Campaign sender connection for one channel at either the platform-default (SYSTEM)
// or per-organization (ORG) scope. Thin container around the shared
// ProviderConnectionForm, adding test-send and — for an org override — removal that
// falls back to the platform default.
@Component({
  selector: 'app-campaign-provider-form',
  imports: [ProviderConnectionForm, MessageModule, ConfirmPopupModule],
  providers: [ConfirmationService, DialogService],
  templateUrl: './campaign-provider-form.html',
})
export class CampaignProviderForm {
  private service = inject(CampaignProviderService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private confirmation = inject(ConfirmationService);
  private dialogService = inject(DialogService);

  readonly scope = input.required<CampaignProviderScope>();
  readonly channel = input.required<MessagingChannel>();

  readonly isOrg = computed(() => this.scope().kind === 'ORG');

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly removing = signal(false);
  readonly provider = signal<MessagingProviderResponse | null>(null);

  readonly defaultTemplateMode = computed(
    () => CHANNEL_DEFAULT_TEMPLATE_MODE[this.channel()] ?? 'CLIENT_RENDERED',
  );

  readonly subtitle = computed(() =>
    this.isOrg()
      ? 'How this organization connects to the vendor for its own campaigns. Secrets are stored write-only and never shown again after saving.'
      : 'The platform-default sender used for campaigns when an organization has no override. Secrets are stored write-only and never shown again after saving.',
  );

  constructor() {
    effect(() => this.load(this.scope(), this.channel()));
  }

  private load(scope: CampaignProviderScope, channel: MessagingChannel): void {
    this.loading.set(true);
    this.provider.set(null);
    this.service.get(scope, channel).subscribe({
      next: (provider) => {
        this.provider.set(provider);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        // 404 simply means this channel isn't configured yet — keep the blank defaults.
        if (error.status !== 404) {
          this.errorHandler.showError(error);
        }
      },
    });
  }

  onSave(request: SaveMessagingProviderRequest): void {
    this.saving.set(true);
    this.service.save(this.scope(), this.channel(), request).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success('Provider connection saved');
        this.provider.set(saved);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onTest(): void {
    this.dialogService.open(CampaignProviderTestDialog, {
      header: 'Send test message',
      width: '32rem',
      modal: true,
      breakpoints: { '640px': '95vw' },
      data: { scope: this.scope(), channel: this.channel() },
    });
  }

  onRemove(event: Event): void {
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: 'Remove this override? Campaigns fall back to the platform default sender.',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Remove', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => this.removeOverride(),
    });
  }

  private removeOverride(): void {
    this.removing.set(true);
    this.service.remove(this.scope(), this.channel()).subscribe({
      next: () => {
        this.removing.set(false);
        this.toast.success('Override removed');
        this.load(this.scope(), this.channel());
      },
      error: (error) => {
        this.removing.set(false);
        this.errorHandler.showError(error);
      },
    });
  }
}
