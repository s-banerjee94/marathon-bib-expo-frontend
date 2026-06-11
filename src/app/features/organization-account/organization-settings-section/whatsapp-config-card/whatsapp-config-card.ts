import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { WhatsappTestDialog } from '../whatsapp-test-dialog/whatsapp-test-dialog';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  SaveWhatsAppConfigRequest,
  WhatsAppConfigResponse,
  WhatsAppSenderMode,
} from '../../../../core/models/whatsapp.model';
import { shouldShowError } from '../../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { OrganizationAccountState } from '../../organization-account-state.service';

@Component({
  selector: 'app-whatsapp-config-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    FloatLabelModule,
    MessageModule,
    ToggleSwitchModule,
    TagModule,
    SkeletonModule,
    ConfirmPopupModule,
  ],
  providers: [ConfirmationService, DialogService],
  templateUrl: './whatsapp-config-card.html',
  styleUrl: './whatsapp-config-card.css',
})
export class WhatsappConfigCard implements OnInit {
  private whatsAppService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private confirmation = inject(ConfirmationService);
  private dialogService = inject(DialogService);
  private state = inject(OrganizationAccountState);

  readonly inputSize = FORM_INPUT_SIZE;
  shouldShowError = shouldShowError;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly togglingMode = signal(false);
  readonly removing = signal(false);

  readonly config = signal<WhatsAppConfigResponse | null>(null);
  readonly customMode = signal(false);

  credentials = {
    accountSid: '',
    authToken: '',
    fromNumber: '',
  };

  ngOnInit(): void {
    this.loadConfig();
  }

  private get orgId(): number | null {
    return this.state.organization()?.id ?? null;
  }

  private loadConfig(): void {
    const id = this.orgId;
    if (id == null) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.whatsAppService.getConfig(id).subscribe({
      next: (config) => {
        this.applyConfig(config);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  private applyConfig(config: WhatsAppConfigResponse): void {
    this.config.set(config);
    this.customMode.set(config.mode === 'CUSTOM');
    this.credentials = {
      accountSid: config.accountSid ?? '',
      authToken: '',
      fromNumber: config.fromNumber ?? '',
    };
  }

  onToggleMode(enabled: boolean): void {
    // A configured org persists the mode immediately; an unconfigured one just
    // reveals the form, since there's nothing to switch to until creds are saved.
    if (this.config()?.configured) {
      this.persistMode(enabled ? 'CUSTOM' : 'DEFAULT');
    } else {
      this.customMode.set(enabled);
      if (!enabled) this.resetCredentials();
    }
  }

  private persistMode(mode: WhatsAppSenderMode): void {
    const id = this.orgId;
    if (id == null) return;
    this.togglingMode.set(true);
    this.whatsAppService.updateMode(id, { mode }).subscribe({
      next: (config) => {
        this.applyConfig(config);
        this.togglingMode.set(false);
        this.toast.success(
          mode === 'CUSTOM'
            ? 'Now sending through your own WhatsApp account'
            : 'Switched to the default WhatsApp sender',
        );
      },
      error: (error) => {
        this.customMode.set(this.config()?.mode === 'CUSTOM');
        this.togglingMode.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onSave(form: NgForm): void {
    if (form.invalid) return;
    const id = this.orgId;
    if (id == null) return;

    const request: SaveWhatsAppConfigRequest = {
      accountSid: this.credentials.accountSid.trim(),
      authToken: this.credentials.authToken,
      fromNumber: this.credentials.fromNumber.trim(),
    };

    this.saving.set(true);
    this.whatsAppService.saveConfig(id, request).subscribe({
      next: (config) => {
        this.applyConfig(config);
        // resetForm (not markAsPristine) clears submitted/touched too, else the
        // now-empty required auth token re-flags an error right after saving.
        form.resetForm(this.credentials);
        this.saving.set(false);
        this.toast.success('WhatsApp credentials saved');
      },
      error: (error) => {
        this.saving.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  resetCredentials(form?: NgForm): void {
    const config = this.config();
    this.credentials = {
      accountSid: config?.accountSid ?? '',
      authToken: '',
      fromNumber: config?.fromNumber ?? '',
    };
    form?.form.markAsPristine();
  }

  onSendTest(): void {
    const id = this.orgId;
    if (id == null) return;
    const ref = this.dialogService.open(WhatsappTestDialog, {
      header: 'Send WhatsApp Test',
      width: '560px',
      modal: true,
      data: { organizationId: id },
    });

    ref?.onClose.subscribe((config: WhatsAppConfigResponse | undefined) => {
      if (config) {
        // Success sets verified=true; reflect it without resetting the form.
        this.config.set(config);
        this.toast.success('Test message sent');
      } else {
        // A failed test sets verified=false server-side — resync verification.
        this.whatsAppService.getConfig(id).subscribe({
          next: (c) => this.config.set(c),
          error: () => {},
        });
      }
    });
  }

  onRemove(event: Event): void {
    const id = this.orgId;
    if (id == null) return;
    this.confirmation.confirm({
      target: event.target as EventTarget,
      message: 'Remove the saved credentials? The organization falls back to the default sender.',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Remove', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => this.removeCredentials(id),
    });
  }

  private removeCredentials(id: number): void {
    this.removing.set(true);
    this.whatsAppService.deleteConfig(id).subscribe({
      next: () => {
        this.applyConfig({ configured: false, mode: 'DEFAULT' });
        this.removing.set(false);
        this.toast.success('WhatsApp credentials removed');
      },
      error: (error) => {
        this.removing.set(false);
        this.errorHandler.showError(error);
      },
    });
  }
}
