/**
 * SMS Template model matching backend SmsTemplateResponse
 * Represents an SMS template for event notifications
 */
export interface SmsTemplate {
  id: number;
  name: string;
  smsTemplateId: string;
  senderId?: string;
  // Message text for a CLIENT_RENDERED provider (#{...} placeholders). Empty for a
  // PROVIDER_RENDERED provider, which uses bodyVariables instead.
  template?: string;
  // Ordered #{fieldName} variable expressions for a PROVIDER_RENDERED provider;
  // entry n fills the gateway template's {{VAR:n}} slot.
  bodyVariables?: string[];
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
  smsTemplateId: string; // Required: 20-200 chars, pattern ^[0-9]+$
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
  smsTemplateId?: string; // 20-200 chars, pattern ^[0-9]+$
  senderId?: string; // 0-32 chars (DLT header)
  template?: string; // CLIENT_RENDERED only: 2-1000 chars
  bodyVariables?: string[]; // PROVIDER_RENDERED only: ordered #{...} expressions, max 20
  note?: string; // 0-500 chars
}
