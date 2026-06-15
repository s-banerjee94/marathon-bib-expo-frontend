import { Component, input, signal } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { MessagingChannel } from '../../../core/models/system-messaging.model';
import { CampaignProviderScope } from '../../../core/models/campaign-provider.model';
import { CampaignProviderForm } from '../campaign-provider-form/campaign-provider-form';
import { CAMPAIGN_CHANNELS, DEFAULT_CAMPAIGN_CHANNEL } from '../campaign-providers.constants';

// Channel tabs (SMS | WhatsApp) over a single campaign-provider form, for either the
// platform-default page or the per-organization settings. The scope is supplied by the
// host; the channel is local state (not URL-driven, so it embeds cleanly anywhere).
@Component({
  selector: 'app-campaign-provider-console',
  imports: [TabsModule, CampaignProviderForm],
  templateUrl: './campaign-provider-console.html',
  styleUrl: './campaign-provider-console.css',
})
export class CampaignProviderConsole {
  readonly scope = input.required<CampaignProviderScope>();

  readonly channels = CAMPAIGN_CHANNELS;
  readonly selectedChannel = signal<MessagingChannel>(DEFAULT_CAMPAIGN_CHANNEL);

  onChannelChange(value: string | number | undefined): void {
    if (value != null) this.selectedChannel.set(value as MessagingChannel);
  }
}
