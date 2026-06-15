import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { CampaignProviderService } from '../../../core/services/campaign-provider.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { MessagingChannel } from '../../../core/models/system-messaging.model';
import {
  CampaignProviderScope,
  ProviderTestSendRequest,
} from '../../../core/models/campaign-provider.model';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

interface TestDialogData {
  scope: CampaignProviderScope;
  channel: MessagingChannel;
}

// Live test-send against the configured campaign provider. The backend returns 200 on
// a successful provider call and 502 when the provider rejects it — surfaced verbatim.
@Component({
  selector: 'app-campaign-provider-test-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
  ],
  templateUrl: './campaign-provider-test-dialog.html',
  styleUrl: './campaign-provider-test-dialog.css',
})
export class CampaignProviderTestDialog {
  readonly shouldShowError = shouldShowError;
  readonly inputSize = FORM_INPUT_SIZE;

  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private service = inject(CampaignProviderService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);

  private readonly data = this.config.data as TestDialogData;
  readonly channel = this.data.channel;
  readonly isWhatsApp = this.channel === 'WHATSAPP';

  readonly submitting = signal(false);

  formData = {
    recipientPhone: '',
    templateId: '',
    senderId: '',
    message: '',
    // One variable per line; only used for provider-rendered (WhatsApp).
    variables: '',
  };

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    const request: ProviderTestSendRequest = {
      recipientPhone: this.formData.recipientPhone.trim(),
    };
    const templateId = this.formData.templateId.trim();
    if (templateId) request.templateId = templateId;

    if (this.isWhatsApp) {
      const variables = this.formData.variables
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (variables.length) request.variables = variables;
    } else {
      const senderId = this.formData.senderId.trim();
      const message = this.formData.message.trim();
      if (senderId) request.senderId = senderId;
      if (message) request.message = message;
    }

    this.submitting.set(true);
    this.service.test(this.data.scope, this.channel, request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Test message sent');
        this.ref.close(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onCancel(): void {
    this.ref.close();
  }
}
