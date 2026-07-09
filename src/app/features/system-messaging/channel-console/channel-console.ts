import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { ProviderConfig } from '../provider-config/provider-config';
import { ChannelTemplates } from '../channel-templates/channel-templates';
import { MessagingChannel } from '../../../core/models/system-messaging.model';
import {
  ChannelMeta,
  DEFAULT_CHANNEL,
  SYSTEM_MESSAGING_CHANNELS,
} from '../system-messaging.constants';

// One channel tab: a header, the provider connection, and the message templates,
// stacked. EMAIL renders a coming-soon placeholder. The instance is reused across
// tabs, so it tracks the :channel param reactively.
@Component({
  selector: 'app-channel-console',
  imports: [ProviderConfig, ChannelTemplates],
  templateUrl: './channel-console.html',
  styleUrl: './channel-console.css',
})
export class ChannelConsole {
  private route = inject(ActivatedRoute);

  readonly channel = signal<MessagingChannel>(DEFAULT_CHANNEL);
  readonly channelMeta = signal<ChannelMeta | undefined>(undefined);

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => (p.get('channel') ?? DEFAULT_CHANNEL) as MessagingChannel),
        takeUntilDestroyed(),
      )
      .subscribe((channel) => {
        this.channel.set(channel);
        this.channelMeta.set(SYSTEM_MESSAGING_CHANNELS.find((c) => c.value === channel));
      });
  }
}
