import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { WhatsAppTestSendRequest } from '../../../../core/models/whatsapp.model';
import { shouldShowError } from '../../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { PlaceholderVariablePicker } from '../../../../shared/components/placeholder-variable-picker/placeholder-variable-picker';

@Component({
  selector: 'app-whatsapp-test-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    FloatLabelModule,
    MessageModule,
    PlaceholderVariablePicker,
  ],
  templateUrl: './whatsapp-test-dialog.html',
  styleUrl: './whatsapp-test-dialog.css',
})
export class WhatsappTestDialog {
  readonly shouldShowError = shouldShowError;

  private config = inject(DynamicDialogConfig);
  private ref = inject(DynamicDialogRef);
  private whatsAppService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);

  isSubmitting = signal(false);
  bodyVariables = signal<string[]>([]);

  readonly inputSize = FORM_INPUT_SIZE;

  private organizationId = this.config.data?.organizationId as number;

  formData = {
    contentSid: '',
    toNumber: '',
  };

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    const request: WhatsAppTestSendRequest = {
      contentSid: this.formData.contentSid.trim(),
      toNumber: this.formData.toNumber.trim(),
    };
    if (this.bodyVariables().length) {
      request.bodyVariables = this.bodyVariables();
    }

    this.isSubmitting.set(true);
    this.whatsAppService.testSend(this.organizationId, request).subscribe({
      next: (config) => {
        this.isSubmitting.set(false);
        this.ref.close(config);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorHandler.showError(error, 'Failed to send test message');
      },
    });
  }

  onCancel(): void {
    this.ref.close();
  }
}
