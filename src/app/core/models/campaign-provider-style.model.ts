import { MessageContentType, MessagingChannel, TemplateMode } from './system-messaging.model';

export type { MessagingChannel, TemplateMode };

// Which configured provider applies for the channel: the organization's own
// override, or the platform default. Null when none is configured.
export type CampaignProviderSource = 'ORGANIZATION' | 'DEFAULT';

// Rendering hints for the effective campaign provider on a channel, resolved from
// GET /api/events/{eventId}/campaign-provider-style. `hasProvider` is false when
// neither an org override nor a platform default is enabled — the UI should prompt
// to configure one before authoring. `templateMode` drives whether a template is
// message-text (CLIENT_RENDERED) or positional-variable (PROVIDER_RENDERED) based.
// No connection details or secrets are returned.
export interface CampaignProviderStyle {
  hasProvider: boolean;
  source?: CampaignProviderSource | null;
  templateMode?: TemplateMode | null;
  contentType?: MessageContentType | null;
}
