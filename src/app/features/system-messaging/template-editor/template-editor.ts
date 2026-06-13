import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  PlaceholderOption,
  PlaceholderVariablePicker,
} from '../../../shared/components/placeholder-variable-picker/placeholder-variable-picker';
import { SystemMessagingService } from '../../../core/services/system-messaging.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MessagePurpose,
  MessagingChannel,
  SaveSystemMessageTemplateRequest,
  SystemMessageTemplateResponse,
} from '../../../core/models/system-messaging.model';
import {
  CHANNEL_DEFAULT_TEMPLATE_MODE,
  ChannelMeta,
  MESSAGE_PURPOSES,
  PurposeMeta,
  SYSTEM_MESSAGE_PLACEHOLDERS,
  SYSTEM_MESSAGING_CHANNELS,
} from '../system-messaging.constants';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { shouldShowError } from '../../../shared/utils/form.utils';

interface TemplateForm {
  body: string;
  dltTemplateId: string;
  senderId: string;
  enabled: boolean;
}

// Accepts purpose+channel either via route params (withComponentInputBinding) or as
// dialog config data. When opened as a dialog, `dialogRef` is injected by PrimeNG.
@Component({
  selector: 'app-template-editor',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    ToggleSwitchModule,
    FloatLabelModule,
    MessageModule,
    TagModule,
    SkeletonModule,
    PlaceholderVariablePicker,
  ],
  templateUrl: './template-editor.html',
  styleUrl: './template-editor.css',
})
export class TemplateEditor implements OnInit {
  private route = inject(ActivatedRoute, { optional: true });
  private router = inject(Router, { optional: true });
  private dialogRef = inject(DynamicDialogRef, { optional: true });
  private dialogConfig = inject(DynamicDialogConfig, { optional: true });
  private service = inject(SystemMessagingService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);

  readonly inputSize = FORM_INPUT_SIZE;
  readonly shouldShowError = shouldShowError;

  // Resolved after ngOnInit from route inputs or dialog config.
  protected purpose!: MessagePurpose;
  protected channel!: MessagingChannel;
  protected purposeMeta?: PurposeMeta;
  protected channelMeta?: ChannelMeta;
  protected usesVariables = false;
  protected placeholderOptions: PlaceholderOption[] = [];
  protected isDialog = false;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly template = signal<SystemMessageTemplateResponse | null>(null);
  readonly variables = signal<string[]>([]);

  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');

  model: TemplateForm = { body: '', dltTemplateId: '', senderId: '', enabled: false };

  ngOnInit(): void {
    if (this.dialogRef && this.dialogConfig?.data) {
      this.isDialog = true;
      this.purpose = this.dialogConfig.data['purpose'];
      this.channel = this.dialogConfig.data['channel'];
    } else {
      this.purpose = this.route?.snapshot.paramMap.get('purpose') as MessagePurpose;
      this.channel = this.route?.snapshot.paramMap.get('channel') as MessagingChannel;
    }

    this.purposeMeta = MESSAGE_PURPOSES.find((p) => p.value === this.purpose);
    this.channelMeta = SYSTEM_MESSAGING_CHANNELS.find((c) => c.value === this.channel);
    this.usesVariables = CHANNEL_DEFAULT_TEMPLATE_MODE[this.channel] === 'PROVIDER_RENDERED';
    this.placeholderOptions = SYSTEM_MESSAGE_PLACEHOLDERS[this.purpose] ?? [];
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.getTemplate(this.purpose, this.channel).subscribe({
      next: (template) => {
        this.applyTemplate(template);
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

  private applyTemplate(template: SystemMessageTemplateResponse): void {
    this.template.set(template);
    this.model = {
      body: template.body ?? '',
      dltTemplateId: template.dltTemplateId ?? '',
      senderId: template.senderId ?? '',
      enabled: template.enabled,
    };
    this.variables.set(this.splitVariables(template.variables));
  }

  insertPlaceholder(token: string): void {
    const el = this.bodyInput()?.nativeElement;
    if (!el) {
      this.model.body += token;
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    this.model.body = el.value.slice(0, start) + token + el.value.slice(end);
    queueMicrotask(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  onSave(form: NgForm): void {
    if (form.invalid) return;

    const request: SaveSystemMessageTemplateRequest = {
      dltTemplateId: this.trimOrUndefined(this.model.dltTemplateId),
      senderId: this.trimOrUndefined(this.model.senderId),
      enabled: this.model.enabled,
    };
    if (this.usesVariables) {
      request.variables = this.variables().join('\n');
    } else {
      request.body = this.model.body;
    }

    this.saving.set(true);
    this.service.saveTemplate(this.purpose, this.channel, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Template saved');
        if (this.isDialog) {
          this.dialogRef!.close({ saved: true });
        } else {
          this.router!.navigate(['/system-messaging', this.channel]);
        }
      },
      error: (error) => {
        this.saving.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  onCancel(): void {
    if (this.isDialog) {
      this.dialogRef!.close();
    } else {
      this.router!.navigate(['/system-messaging', this.channel]);
    }
  }

  private splitVariables(variables?: string): string[] {
    if (!variables) return [];
    return variables
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private trimOrUndefined(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
}
