import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { Participant } from '../../../../core/models/participant.model';
import { UserRole } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ParticipantMessageChannel,
  SendParticipantMessagesRequest,
} from '../../../../core/models/participant-message.model';
import { CampaignProviderStyle } from '../../../../core/models/campaign-provider-style.model';
import { ParticipantMessageService } from '../../../../core/services/participant-message.service';
import { CampaignProviderStyleService } from '../../../../core/services/campaign-provider-style.service';
import { SmsTemplateService } from '../../../../core/services/sms-template.service';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { shouldShowError } from '../../../../shared/utils/form.utils';

interface TemplateOption {
  id: number;
  name: string;
}

// Sentinel for "send whatever the active bib-collection campaign sends" — the API
// resolves that template itself when templateId is omitted, which is the one-click
// "send it again" path. Kept out of the number space real template ids use.
const CAMPAIGN_DEFAULT_TEMPLATE_ID = -1;

@Component({
  selector: 'app-participant-message-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-message-dialog.html',
  imports: [
    FormsModule,
    RouterLink,
    DialogModule,
    ButtonModule,
    SelectModule,
    SelectButtonModule,
    FloatLabelModule,
    MessageModule,
    TagModule,
  ],
})
export class ParticipantMessageDialog {
  private messageService = inject(ParticipantMessageService);
  private providerStyleService = inject(CampaignProviderStyleService);
  private smsTemplateService = inject(SmsTemplateService);
  private whatsappService = inject(WhatsAppService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);

  readonly shouldShowError = shouldShowError;
  readonly inputSize = FORM_INPUT_SIZE;

  visible = model<boolean>(false);
  eventId = input.required<number>();
  participant = input<Participant | null>(null);

  // EMAIL is listed but disabled: the send endpoint rejects it ("not available yet").
  readonly channelOptions = [
    { label: 'SMS', value: 'SMS', disabled: false },
    { label: 'WhatsApp', value: 'WHATSAPP', disabled: false },
    { label: 'Email', value: 'EMAIL', disabled: true },
  ];

  channel = signal<ParticipantMessageChannel>('SMS');
  templateId = signal<number | null>(null);
  templates = signal<TemplateOption[]>([]);
  loadingTemplates = signal(false);
  providerStyle = signal<CampaignProviderStyle | null>(null);
  loadingProvider = signal(false);
  isSending = signal(false);
  // The backend's verbatim reason for a FAILED result — a 200 can still mean "not sent".
  failureReason = signal<string | null>(null);

  // Per-channel caches so switching back and forth doesn't refetch, and so a template
  // already picked for a channel survives a switch away and back.
  private templateCache = new Map<ParticipantMessageChannel, TemplateOption[]>();
  private providerCache = new Map<ParticipantMessageChannel, CampaignProviderStyle>();
  private templateIdByChannel = new Map<ParticipantMessageChannel, number | null>();

  // A resolved style with hasProvider false means the send would 502 — block instead.
  providerMissing = computed(() => this.providerStyle()?.hasProvider === false);

  channelLabel = computed(() => (this.channel() === 'SMS' ? 'SMS' : 'WhatsApp'));

  // Only the campaign-default sentinel is present when the event has no templates.
  hasOwnTemplates = computed(() => this.templates().length > 1);

  readonly canConfigureSenders = inject(AuthService).hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  // Both channels deliver to the participant's phone number.
  destination = computed(() => this.participant()?.phoneNumber?.trim() ?? '');

  canSend = computed(
    () =>
      !this.isSending() &&
      !this.loadingTemplates() &&
      !this.loadingProvider() &&
      !this.providerMissing() &&
      this.templateId() != null,
  );

  constructor() {
    // Caches are event-scoped; another event has different templates and providers.
    effect(() => {
      this.eventId();
      untracked(() => {
        this.templateCache.clear();
        this.providerCache.clear();
        this.templateIdByChannel.clear();
      });
    });
  }

  onShow(): void {
    this.failureReason.set(null);
    this.loadChannelData();
  }

  onChannelChange(channel: ParticipantMessageChannel): void {
    this.channel.set(channel);
    this.failureReason.set(null);
    this.loadChannelData();
  }

  onTemplateChange(templateId: number | null): void {
    this.templateId.set(templateId);
    this.failureReason.set(null);
    this.templateIdByChannel.set(this.channel(), templateId);
  }

  private loadChannelData(): void {
    const channel = this.channel();
    // Default to the campaign template — the common case is "send them the same thing
    // again", and an explicit template is the fallback when no campaign is armed.
    this.templateId.set(this.templateIdByChannel.get(channel) ?? CAMPAIGN_DEFAULT_TEMPLATE_ID);
    this.loadTemplates(channel);
    this.loadProviderStyle(channel);
  }

  private loadTemplates(channel: ParticipantMessageChannel): void {
    const cached = this.templateCache.get(channel);
    if (cached) {
      this.templates.set(cached);
      return;
    }

    const eventId = this.eventId();
    this.templates.set([]);
    this.loadingTemplates.set(true);

    // Both template shapes carry the id/name this picker needs, so the branches
    // widen to a single observable type.
    const request$: Observable<TemplateOption[]> =
      channel === 'SMS'
        ? this.smsTemplateService.getSmsTemplatesByEvent(eventId)
        : this.whatsappService.getTemplatesByEvent(eventId);

    request$.subscribe({
      next: (templates) => {
        const options: TemplateOption[] = [
          { id: CAMPAIGN_DEFAULT_TEMPLATE_ID, name: "Active bib collection campaign's template" },
          ...templates.map((t) => ({ id: t.id, name: t.name })),
        ];
        this.templateCache.set(channel, options);
        // Ignore a response for a channel the user has already switched away from.
        if (this.channel() === channel) this.templates.set(options);
        this.loadingTemplates.set(false);
      },
      error: (error) => {
        this.loadingTemplates.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  private loadProviderStyle(channel: ParticipantMessageChannel): void {
    const cached = this.providerCache.get(channel);
    if (cached) {
      this.providerStyle.set(cached);
      return;
    }

    this.providerStyle.set(null);
    this.loadingProvider.set(true);

    this.providerStyleService.getStyle(this.eventId(), channel).subscribe({
      next: (style) => {
        this.providerCache.set(channel, style);
        if (this.channel() === channel) this.providerStyle.set(style);
        this.loadingProvider.set(false);
      },
      // Leave the style unresolved on failure — the send itself surfaces the real error.
      error: () => this.loadingProvider.set(false),
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid || !this.canSend()) return;

    const participant = this.participant();
    const templateId = this.templateId();
    if (!participant || templateId == null) return;

    const payload: SendParticipantMessagesRequest = {
      channel: this.channel(),
      bibNumbers: [participant.bibNumber],
    };
    // Omitting templateId is what makes the server resolve the campaign's template.
    if (templateId !== CAMPAIGN_DEFAULT_TEMPLATE_ID) payload.templateId = templateId;

    this.isSending.set(true);
    this.failureReason.set(null);

    this.messageService.sendToParticipants(this.eventId(), payload).subscribe({
      next: (response) => {
        this.isSending.set(false);
        const result = response.results?.[0];

        if (result?.status === 'FAILED' || response.failedCount > 0) {
          // Keep the dialog open so another template or channel can be tried.
          this.failureReason.set(result?.reason ?? 'The message could not be sent.');
          return;
        }

        this.toast.success(
          `${this.channelLabel()} sent to ${participant.fullName} (BIB ${participant.bibNumber}) using "${response.templateName}".`,
          'Message Sent',
        );
        this.close();
      },
      error: (error) => {
        this.isSending.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  close(): void {
    if (this.isSending()) return;
    this.visible.set(false);
    this.failureReason.set(null);
  }
}
