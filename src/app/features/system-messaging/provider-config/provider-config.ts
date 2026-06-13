import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { SystemMessagingService } from '../../../core/services/system-messaging.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MessageContentType,
  MessagingChannel,
  MessagingProviderResponse,
  ProviderAuthType,
  ProviderHttpMethod,
  ProviderParam,
  SaveMessagingProviderRequest,
  TemplateMode,
} from '../../../core/models/system-messaging.model';
import {
  AUTH_TYPE_OPTIONS,
  CHANNEL_DEFAULT_TEMPLATE_MODE,
  CONTENT_TYPE_OPTIONS,
  HTTP_METHOD_OPTIONS,
  PROVIDER_TOKENS,
  TEMPLATE_MODE_OPTIONS,
} from '../system-messaging.constants';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { ProviderParamTable } from '../provider-param-table/provider-param-table';

interface ProviderForm {
  baseUrl: string;
  httpMethod: ProviderHttpMethod;
  authType: ProviderAuthType;
  authToken: string;
  username: string;
  password: string;
  templateMode: TemplateMode;
  contentType: MessageContentType;
  bodyTemplate: string;
  enabled: boolean;
}

// Inline provider-connection editor for a single channel. Loads on channel change,
// saves in place (no navigation), and re-applies the masked response so secrets stay
// write-only. Embedded as the first section of the channel console.
@Component({
  selector: 'app-provider-config',
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    TextareaModule,
    ToggleSwitchModule,
    FloatLabelModule,
    MessageModule,
    TagModule,
    SkeletonModule,
    ProviderParamTable,
  ],
  templateUrl: './provider-config.html',
  styleUrl: './provider-config.css',
})
export class ProviderConfig {
  private service = inject(SystemMessagingService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);

  readonly channel = input.required<MessagingChannel>();

  readonly inputSize = FORM_INPUT_SIZE;
  readonly shouldShowError = shouldShowError;
  readonly httpMethodOptions = HTTP_METHOD_OPTIONS;
  readonly authTypeOptions = AUTH_TYPE_OPTIONS;
  readonly templateModeOptions = TEMPLATE_MODE_OPTIONS;
  readonly contentTypeOptions = CONTENT_TYPE_OPTIONS;
  readonly tokens = PROVIDER_TOKENS;
  // Bound (not inlined) so Angular doesn't interpret the {{…}} tokens as interpolation.
  readonly bodyPlaceholder = '{"route":"otp","numbers":"{{RECIPIENT}}","message":"{{MESSAGE}}"}';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly provider = signal<MessagingProviderResponse | null>(null);
  readonly params = signal<ProviderParam[]>([]);

  model: ProviderForm = this.blankModel('CLIENT_RENDERED');

  constructor() {
    effect(() => this.load(this.channel()));
  }

  private blankModel(templateMode: TemplateMode): ProviderForm {
    return {
      baseUrl: '',
      httpMethod: 'POST',
      authType: 'TOKEN',
      authToken: '',
      username: '',
      password: '',
      templateMode,
      contentType: 'JSON',
      bodyTemplate: '',
      enabled: false,
    };
  }

  private load(channel: MessagingChannel): void {
    this.loading.set(true);
    this.provider.set(null);
    this.model = this.blankModel(CHANNEL_DEFAULT_TEMPLATE_MODE[channel] ?? 'CLIENT_RENDERED');
    this.params.set([]);
    this.service.getProvider(channel).subscribe({
      next: (provider) => {
        this.applyProvider(provider);
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

  private applyProvider(provider: MessagingProviderResponse): void {
    this.provider.set(provider);
    this.model = {
      baseUrl: provider.baseUrl ?? '',
      httpMethod: provider.httpMethod,
      authType: provider.authType,
      authToken: '',
      username: provider.username ?? '',
      password: '',
      templateMode: provider.templateMode,
      contentType: provider.contentType ?? 'JSON',
      bodyTemplate: provider.bodyTemplate ?? '',
      enabled: provider.enabled,
    };
    this.params.set(provider.requestParams ? [...provider.requestParams] : []);
  }

  onSave(form: NgForm): void {
    if (form.invalid) return;

    const request: SaveMessagingProviderRequest = {
      baseUrl: this.trimOrUndefined(this.model.baseUrl),
      httpMethod: this.model.httpMethod,
      authType: this.model.authType,
      templateMode: this.model.templateMode,
      requestParams: this.cleanParams(),
      enabled: this.model.enabled,
    };

    // contentType / bodyTemplate are POST-only; the server ignores them for GET.
    if (this.model.httpMethod === 'POST') {
      request.contentType = this.model.contentType;
      request.bodyTemplate = this.model.bodyTemplate.trim().length
        ? this.model.bodyTemplate
        : undefined;
    }

    // Secrets are write-only: send only when the user typed a new value, so a blank
    // field keeps the stored secret. Username is not secret and is always sent.
    if (this.model.authType === 'TOKEN') {
      if (this.model.authToken) request.authToken = this.model.authToken;
    } else {
      request.username = this.trimOrUndefined(this.model.username);
      if (this.model.password) request.password = this.model.password;
    }

    this.saving.set(true);
    this.service.saveProvider(this.channel(), request).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success('Provider connection saved');
        this.applyProvider(saved);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  private cleanParams(): ProviderParam[] {
    return this.params()
      .map((param) => ({ ...param, name: param.name.trim() }))
      .filter((param) => param.name.length > 0);
  }

  private trimOrUndefined(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
}
