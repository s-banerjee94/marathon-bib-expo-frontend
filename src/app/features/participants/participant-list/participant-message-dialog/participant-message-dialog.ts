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
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
import { SmsCampaignService } from '../../../../core/services/sms-campaign.service';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { shouldShowError } from '../../../../shared/utils/form.utils';

interface TemplateOption {
  id: number;
  name: string;
}

// Everything the picker needs for one channel, cached together.
interface ChannelTemplates {
  options: TemplateOption[];
  campaignTemplateName: string | null;
}

// The SMS and WhatsApp campaign shapes differ only in which template-name field
// they carry, so the armed-campaign lookup reads both.
interface CampaignLike {
  name: string;
  status: string;
  triggerType?: string;
  smsTemplateName?: string;
  whatsAppTemplateName?: string;
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
  private smsCampaignService = inject(SmsCampaignService);
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
  // The event's own templates, without the campaign-default sentinel.
  eventTemplates = signal<TemplateOption[]>([]);
  // Template name of the armed bib-collection campaign, or null when none is armed.
  campaignTemplateName = signal<string | null>(null);
  loadingTemplates = signal(false);
  providerStyle = signal<CampaignProviderStyle | null>(null);
  loadingProvider = signal(false);
  isSending = signal(false);
  // The backend's verbatim reason for a FAILED result — a 200 can still mean "not sent".
  failureReason = signal<string | null>(null);

  // Per-channel caches so switching back and forth doesn't refetch, and so a template
  // already picked for a channel survives a switch away and back.
  private templateCache = new Map<ParticipantMessageChannel, ChannelTemplates>();
  private providerCache = new Map<ParticipantMessageChannel, CampaignProviderStyle>();
  private templateIdByChannel = new Map<ParticipantMessageChannel, number | null>();

  // A resolved style with hasProvider false means the send would 502 — block instead.
  providerMissing = computed(() => this.providerStyle()?.hasProvider === false);

  channelLabel = computed(() => (this.channel() === 'SMS' ? 'SMS' : 'WhatsApp'));

  hasCampaignDefault = computed(() => this.campaignTemplateName() !== null);
  hasOwnTemplates = computed(() => this.eventTemplates().length > 0);
  // Nothing to send: no armed campaign to inherit from and no template to pick.
  hasNothingToSend = computed(() => !this.hasCampaignDefault() && !this.hasOwnTemplates());

  // The campaign option is only offered when a campaign is actually armed — omitting
  // templateId otherwise is a guaranteed 400, since the server has nothing to resolve.
  templates = computed<TemplateOption[]>(() => {
    const name = this.campaignTemplateName();
    return name
      ? [
          { id: CAMPAIGN_DEFAULT_TEMPLATE_ID, name: `Campaign template — ${name}` },
          ...this.eventTemplates(),
        ]
      : this.eventTemplates();
  });

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
    this.loadTemplates(this.channel());
    this.loadProviderStyle(this.channel());
  }

  // Applies a channel's templates and picks the default selection: the armed
  // campaign's template when there is one, otherwise whatever the user last chose.
  private applyChannelTemplates(channel: ParticipantMessageChannel, data: ChannelTemplates): void {
    this.eventTemplates.set(data.options);
    this.campaignTemplateName.set(data.campaignTemplateName);

    const remembered = this.templateIdByChannel.get(channel);
    if (remembered != null && this.templates().some((t) => t.id === remembered)) {
      this.templateId.set(remembered);
    } else {
      this.templateId.set(data.campaignTemplateName ? CAMPAIGN_DEFAULT_TEMPLATE_ID : null);
    }
  }

  private loadTemplates(channel: ParticipantMessageChannel): void {
    const cached = this.templateCache.get(channel);
    if (cached) {
      this.applyChannelTemplates(channel, cached);
      return;
    }

    const eventId = this.eventId();
    this.eventTemplates.set([]);
    this.campaignTemplateName.set(null);
    this.loadingTemplates.set(true);

    // Both template shapes carry the id/name this picker needs, so the branches
    // widen to a single observable type.
    const templates$: Observable<TemplateOption[]> =
      channel === 'SMS'
        ? this.smsTemplateService.getSmsTemplatesByEvent(eventId)
        : this.whatsappService.getTemplatesByEvent(eventId);

    // The campaign lookup only decides whether to offer the inherit-from-campaign
    // option, so a failure degrades to "not offered" rather than blocking the dialog.
    const campaigns$: Observable<CampaignLike[]> =
      channel === 'SMS'
        ? this.smsCampaignService.getCampaignsByEvent(eventId)
        : this.whatsappService.getCampaignsByEvent(eventId);

    const campaignName$: Observable<string | null> = campaigns$.pipe(
      map((campaigns) => this.armedBibCollectionTemplateName(campaigns)),
      catchError(() => of(null)),
    );

    forkJoin({ templates: templates$, campaignTemplateName: campaignName$ }).subscribe({
      next: ({ templates, campaignTemplateName }) => {
        const data: ChannelTemplates = {
          options: templates.map((t) => ({ id: t.id, name: t.name })),
          campaignTemplateName,
        };
        this.templateCache.set(channel, data);
        // Ignore a response for a channel the user has already switched away from.
        if (this.channel() === channel) this.applyChannelTemplates(channel, data);
        this.loadingTemplates.set(false);
      },
      error: (error) => {
        this.loadingTemplates.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  // Only an armed AUTO_BIB_COLLECTED campaign is what the server resolves an omitted
  // templateId against. DRAFT does not count.
  private armedBibCollectionTemplateName(campaigns: CampaignLike[]): string | null {
    const armed = campaigns.find(
      (c) =>
        c.triggerType === 'AUTO_BIB_COLLECTED' && (c.status === 'ACTIVE' || c.status === 'SENDING'),
    );
    if (!armed) return null;
    return armed.smsTemplateName ?? armed.whatsAppTemplateName ?? armed.name;
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
