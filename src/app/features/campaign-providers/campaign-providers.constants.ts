import { MessagingChannel } from '../../core/models/system-messaging.model';

// Channels available for campaign senders. Unlike system messaging, campaigns have
// no EMAIL channel — only SMS and WhatsApp.
export interface CampaignChannelMeta {
  value: MessagingChannel;
  label: string;
  icon: string;
}

export const CAMPAIGN_CHANNELS: CampaignChannelMeta[] = [
  { value: 'SMS', label: 'SMS', icon: 'pi pi-comment' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'pi pi-whatsapp' },
];

export const DEFAULT_CAMPAIGN_CHANNEL: MessagingChannel = 'SMS';
