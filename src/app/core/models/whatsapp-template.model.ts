import { TemplateMode } from './system-messaging.model';
import { CampaignProviderSource } from './campaign-provider-style.model';

export interface WhatsAppTemplate {
  id: number;
  name: string;
  contentSid: string;
  body?: string;
  bodyVariables?: string[];
  // Always PROVIDER_RENDERED for WhatsApp — the vendor holds the approved template.
  renderMode?: TemplateMode;
  // Sender this template's Content SID was registered under; sending is refused when
  // the sender in force is the other source. Null on pre-existing templates.
  providerSource?: CampaignProviderSource;
  note?: string;
  eventId: number;
  organizationId?: number;
  eventName?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface CreateWhatsAppTemplateRequest {
  name: string;
  contentSid: string;
  body: string;
  bodyVariables?: string[];
  note?: string;
}

export interface UpdateWhatsAppTemplateRequest {
  name?: string;
  contentSid?: string;
  body?: string;
  bodyVariables?: string[];
  note?: string;
}
