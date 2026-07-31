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
  BODY_CARRYING_METHODS,
  CONTENT_TYPE_OPTIONS,
  HTTP_METHOD_OPTIONS,
  PROVIDER_TOKENS,
  ProviderToken,
  TEMPLATE_MODE_OPTIONS,
  TOKEN_INDEXING_NOTE,
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
  defaultCountryCode: string;
  successContains: string;
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
  // Drives which recipient token the request must carry, and which tokens the panel dims.
  readonly channel = input<MessagingChannel>('SMS');
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
  readonly indexingNote = TOKEN_INDEXING_NOTE;
  // Bound (not inlined) so Angular doesn't interpret the {{…}} tokens as interpolation.
  readonly bodyPlaceholder = '{"route":"otp","numbers":"{{RECIPIENT}}","message":"{{MESSAGE}}"}';
  // Same reason as above — inlining it in the template reads as an interpolation.
  readonly e164Token = '{{RECIPIENT_E164}}';

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
      // The server stopped defaulting this, so a blank now fails at save when the
      // mapping builds an international number — pre-fill the previous default.
      defaultCountryCode: '91',
      successContains: '',
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
      defaultCountryCode: provider.defaultCountryCode ?? '',
      successContains: provider.successContains ?? '',
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
      defaultCountryCode: this.trimOrUndefined(this.model.defaultCountryCode),
      successContains: this.trimOrUndefined(this.model.successContains),
      enabled: this.model.enabled,
    };

    // contentType / bodyTemplate only apply to the body-carrying verbs; the server
    // ignores them for GET.
    if (this.usesBody()) {
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

  usesBody(): boolean {
    return BODY_CARRYING_METHODS.includes(this.model.httpMethod);
  }

  // Tokens are substituted in the URL, in any header/query value and in the body,
  // so every check below reads the whole request surface, not just the body.
  private requestSurface(): string {
    const paramValues = this.params()
      .map((param) => param.value ?? '')
      .join('\n');
    const body = this.usesBody() ? this.model.bodyTemplate : '';
    return `${this.model.baseUrl}\n${paramValues}\n${body}`;
  }

  // The same contradictions the server rejects on save, caught where they are typed.
  // Warnings only — the server stays the backstop.
  requestWarnings(): string[] {
    const surface = this.requestSurface();
    const warnings: string[] = [];

    if (this.model.templateMode === 'CLIENT_RENDERED' && !surface.includes('{{MESSAGE}}')) {
      warnings.push(
        'This provider is set to send the finished message text, but its request never uses {{MESSAGE}}. Add it, or set the provider to render the message itself.',
      );
    }

    if (
      this.model.templateMode === 'PROVIDER_RENDERED' &&
      !/\{\{VAR:\d+\}\}/.test(surface) &&
      !surface.includes('{{VARIABLES_JSON}}')
    ) {
      warnings.push(
        'This provider is set to render the message from its own registered template, but its request never uses {{VAR:n}} or {{VARIABLES_JSON}}. Add one, or set the provider to send the finished message text.',
      );
    }

    if (this.channel() === 'EMAIL') {
      if (!surface.includes('{{RECIPIENT_EMAIL}}')) {
        warnings.push(
          'This provider sends email but its request never uses {{RECIPIENT_EMAIL}}, so it has no address to send to. Add it.',
        );
      }
    } else if (!surface.includes('{{RECIPIENT}}') && !surface.includes('{{RECIPIENT_E164}}')) {
      warnings.push(
        "This provider's request never uses {{RECIPIENT}} or {{RECIPIENT_E164}}, so it has no number to send to. Add one.",
      );
    }

    // Both international forms are built from the country code, which is no longer
    // defaulted server-side — a blank one is rejected at save.
    const buildsInternational =
      surface.includes('{{RECIPIENT_E164}}') || surface.includes('{{RECIPIENT_CC}}');
    if (buildsInternational && !this.model.defaultCountryCode.trim()) {
      warnings.push(
        "This provider builds an international number, so it needs a country code. Set one above — it is no longer assumed to be India's.",
      );
    }

    return warnings;
  }

  // Templates keep the renderMode they were authored under, so flipping the mode on a
  // saved sender strands them — the compatibility check will refuse them at send time.
  templateModeChanged(): boolean {
    const saved = this.provider();
    return !!saved && saved.templateMode !== this.model.templateMode;
  }

  // Dim tokens that don't apply to the selected mode / channel — the panel is where
  // the author's eye goes, so it should not offer tokens that will be ignored.
  isTokenApplicable(token: ProviderToken): boolean {
    const modeOk = !token.modes || token.modes.includes(this.model.templateMode);
    const channelOk = !token.channels || token.channels.includes(this.channel());
    return modeOk && channelOk;
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
