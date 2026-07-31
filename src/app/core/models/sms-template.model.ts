import { TemplateMode } from './system-messaging.model';
import { CampaignProviderSource } from './campaign-provider-style.model';

/**
 * SMS Template model matching backend SmsTemplateResponse
 * Represents an SMS template for event notifications
 */
export interface SmsTemplate {
  id: number;
  name: string;
  // Absent for senders that don't register templates with the vendor.
  smsTemplateId?: string;
  senderId?: string;
  // Message text for a CLIENT_RENDERED provider (#{...} placeholders). Empty for a
  // PROVIDER_RENDERED provider, which uses bodyVariables instead.
  template?: string;
  // Ordered #{fieldName} variable expressions for a PROVIDER_RENDERED provider;
  // entry n fills the gateway template's {{VAR:n}} slot.
  bodyVariables?: string[];
  // Shape the template was authored for. Stamped by the server at create from the
  // org's resolved sender and never changed — editing must follow it, not the
  // sender's current mode, or the wrong content field gets submitted (400).
  renderMode?: TemplateMode;
  // Which sender this template was written against. A registered template id belongs
  // to one vendor account, so sending is refused when the sender in force is the other
  // source. Null on templates written before this was recorded.
  providerSource?: CampaignProviderSource;
  note?: string;
  eventId: number;
  eventName?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

/**
 * Create SMS Template Request DTO
 */
export interface CreateSmsTemplateRequest {
  name: string; // Required: 0-100 chars
  // Optional, max 100 — needed only when the sender's request reads {{TEMPLATE_ID}}.
  smsTemplateId?: string;
  senderId?: string; // Optional: 0-32 chars (DLT header)
  template?: string; // CLIENT_RENDERED only: 2-1000 chars. Provide this OR bodyVariables.
  bodyVariables?: string[]; // PROVIDER_RENDERED only: ordered #{...} expressions, max 20
  note?: string; // Optional: 0-500 chars
}

/**
 * Update SMS Template Request DTO (all fields optional for PATCH)
 */
export interface UpdateSmsTemplateRequest {
  name?: string; // 0-100 chars
  smsTemplateId?: string; // max 100
  senderId?: string; // 0-32 chars (DLT header)
  template?: string; // CLIENT_RENDERED only: 2-1000 chars
  bodyVariables?: string[]; // PROVIDER_RENDERED only: ordered #{...} expressions, max 20
  note?: string; // 0-500 chars
}
