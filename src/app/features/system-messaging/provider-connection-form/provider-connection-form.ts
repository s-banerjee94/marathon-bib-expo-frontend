import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
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
import {
  MessageContentType,
  MessagingProviderResponse,
  ProviderAuthType,
  ProviderHttpMethod,
  ProviderParam,
  SaveMessagingProviderRequest,
  TemplateMode,
} from '../../../core/models/system-messaging.model';
import {
  AUTH_TYPE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  HTTP_METHOD_OPTIONS,
  PROVIDER_TOKENS,
  TEMPLATE_MODE_OPTIONS,
} from '../system-messaging.constants';
import { ProviderParamTable } from '../provider-param-table/provider-param-table';
import { shouldShowError } from '../../../shared/utils/form.utils';
import { FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';

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

// Presentational editor for a messaging provider connection, shared by the system
// messaging and campaign sender consoles. It owns the form fields, write-only secret
// handling, and request building; the host owns loading the data and persisting it.
// Re-initializes whenever the `provider` input changes (e.g. after a save or channel
// switch). A `banner` slot renders host content above the form.
@Component({
  selector: 'app-provider-connection-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  templateUrl: './provider-connection-form.html',
  styleUrl: './provider-connection-form.css',
})
export class ProviderConnectionForm {
  readonly provider = input<MessagingProviderResponse | null>(null);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly removing = input(false);
  readonly defaultTemplateMode = input<TemplateMode>('CLIENT_RENDERED');
  readonly subtitle = input('');
  readonly enabledHint = input('When off, this provider is saved but never used to send messages.');
  readonly showTest = input(false);
  readonly showRemove = input(false);

  readonly save = output<SaveMessagingProviderRequest>();
  readonly test = output<void>();
  readonly remove = output<Event>();

  readonly inputSize = FORM_INPUT_SIZE;
  readonly shouldShowError = shouldShowError;
  readonly httpMethodOptions = HTTP_METHOD_OPTIONS;
  readonly authTypeOptions = AUTH_TYPE_OPTIONS;
  readonly templateModeOptions = TEMPLATE_MODE_OPTIONS;
  readonly contentTypeOptions = CONTENT_TYPE_OPTIONS;
  readonly tokens = PROVIDER_TOKENS;
  // Bound (not inlined) so Angular doesn't interpret the {{…}} tokens as interpolation.
  readonly bodyPlaceholder = '{"route":"otp","numbers":"{{RECIPIENT}}","message":"{{MESSAGE}}"}';

  readonly params = signal<ProviderParam[]>([]);

  model: ProviderForm = this.blankModel('CLIENT_RENDERED');

  constructor() {
    // Reset the form to mirror the latest provider (or blank defaults) whenever the
    // host swaps it in — covers channel switches and the post-save masked refresh.
    effect(() => {
      const provider = this.provider();
      if (provider) {
        this.applyProvider(provider);
      } else {
        this.model = this.blankModel(this.defaultTemplateMode());
        this.params.set([]);
      }
    });
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

  private applyProvider(provider: MessagingProviderResponse): void {
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

  onSubmit(form: NgForm): void {
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

    this.save.emit(request);
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
