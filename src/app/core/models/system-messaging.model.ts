// Domain contracts for the ROOT-only System Messaging console — provider
// connections and per-purpose/per-channel message content. Mirrors the
// `/v3/api-docs/8-system-messaging` OpenAPI group.

export type MessagingChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';
export type MessagePurpose = 'INVITE' | 'PASSWORD_RESET' | 'OTP';

export type ProviderHttpMethod = 'GET' | 'POST';
export type ProviderAuthType = 'TOKEN' | 'USERNAME_PASSWORD';
export type TemplateMode = 'CLIENT_RENDERED' | 'PROVIDER_RENDERED';
// POST body encoding; ignored for GET. Defaults to JSON server-side.
export type MessageContentType = 'JSON' | 'FORM';

export type ParamLocation = 'HEADER' | 'QUERY';

// One header or query parameter of the vendor request. `value` is free text that
// may embed {{TOKEN}} placeholders the backend substitutes at send time.
export interface ProviderParam {
  name: string;
  location: ParamLocation;
  value: string;
}

export interface SaveMessagingProviderRequest {
  baseUrl?: string;
  httpMethod: ProviderHttpMethod;
  authType: ProviderAuthType;
  // Secrets are write-only — omit (or leave blank) to keep the stored value.
  authToken?: string;
  username?: string;
  password?: string;
  templateMode: TemplateMode;
  // POST only — encoding of `bodyTemplate`; omitted for GET.
  contentType?: MessageContentType;
  // Header + query parameters (no body params; the body comes from `bodyTemplate`).
  requestParams?: ProviderParam[];
  // POST only — raw request body with {{TOKEN}} placeholders.
  bodyTemplate?: string;
  enabled?: boolean;
}

export interface MessagingProviderResponse {
  channel: MessagingChannel;
  baseUrl?: string;
  httpMethod: ProviderHttpMethod;
  authType: ProviderAuthType;
  // Masked secret tails (e.g. '••••8U4z'); null/absent when not set. Raw secrets are never returned.
  authTokenMasked?: string;
  username?: string;
  passwordMasked?: string;
  templateMode: TemplateMode;
  contentType?: MessageContentType;
  requestParams?: ProviderParam[];
  bodyTemplate?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveSystemMessageTemplateRequest {
  // Client-rendered channels (SMS): message text with #{...} placeholders.
  body?: string;
  // Provider-rendered channels (WhatsApp): newline-separated #{...} → positional variables.
  variables?: string;
  // Registered template id: DLT template id (SMS) or provider Content SID (WhatsApp).
  dltTemplateId?: string;
  senderId?: string;
  enabled?: boolean;
}

export interface SystemMessageTemplateResponse {
  purpose: MessagePurpose;
  channel: MessagingChannel;
  body?: string;
  variables?: string;
  dltTemplateId?: string;
  senderId?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}
