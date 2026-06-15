import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SystemMessagingService } from '../../../core/services/system-messaging.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MessagingChannel,
  MessagingProviderResponse,
  SaveMessagingProviderRequest,
} from '../../../core/models/system-messaging.model';
import { CHANNEL_DEFAULT_TEMPLATE_MODE } from '../system-messaging.constants';
import { ProviderConnectionForm } from '../provider-connection-form/provider-connection-form';

// System messaging provider connection for a single channel. Thin container around the
// shared ProviderConnectionForm: loads on channel change and saves in place. The 404
// from get-by-channel means "not configured yet" — kept as blank defaults.
@Component({
  selector: 'app-provider-config',
  imports: [ProviderConnectionForm],
  template: `
    <app-provider-connection-form
      [provider]="provider()"
      [loading]="loading()"
      [saving]="saving()"
      [defaultTemplateMode]="defaultTemplateMode()"
      subtitle="How the platform connects to the vendor to send messages. Secrets are stored write-only and never shown again after saving."
      (save)="onSave($event)"
    />
  `,
})
export class ProviderConfig {
  private service = inject(SystemMessagingService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);

  readonly channel = input.required<MessagingChannel>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly provider = signal<MessagingProviderResponse | null>(null);

  readonly defaultTemplateMode = computed(
    () => CHANNEL_DEFAULT_TEMPLATE_MODE[this.channel()] ?? 'CLIENT_RENDERED',
  );

  constructor() {
    effect(() => this.load(this.channel()));
  }

  private load(channel: MessagingChannel): void {
    this.loading.set(true);
    this.provider.set(null);
    this.service.getProvider(channel).subscribe({
      next: (provider) => {
        this.provider.set(provider);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        if (error.status !== 404) {
          this.errorHandler.showError(error);
        }
      },
    });
  }

  onSave(request: SaveMessagingProviderRequest): void {
    this.saving.set(true);
    this.service.saveProvider(this.channel(), request).subscribe({
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
}
