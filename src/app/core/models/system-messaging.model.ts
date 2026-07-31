// Domain contracts for the ROOT-only System Messaging console — provider
// connections and per-purpose/per-channel message content. Mirrors the
// `/v3/api-docs/8-system-messaging` OpenAPI group.

export type MessagingChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';
export type MessagePurpose = 'INVITE' | 'PASSWORD_RESET' | 'OTP';

export type ProviderHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';
export type ProviderAuthType = 'TOKEN' | 'USERNAME_PASSWORD';
export type TemplateMode = 'CLIENT_RENDERED' | 'PROVIDER_RENDERED';
// Body encoding for the body-carrying verbs; ignored for GET. Defaults to JSON
// server-side, which also picks the escaping (JSON, form-urlencoding, XML entities,
// raw for TEXT).
export type MessageContentType = 'JSON' | 'FORM' | 'XML' | 'TEXT';

export type ParamLocation = 'HEADER' | 'QUERY';

// Whether a provider row is a transactional system sender or a campaign sender.
export type ProviderUsage = 'SYSTEM' | 'CAMPAIGN';

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
  // Body-carrying verbs only — encoding of `bodyTemplate`; omitted for GET.
  contentType?: MessageContentType;
  // Header + query parameters (no body params; the body comes from `bodyTemplate`).
  requestParams?: ProviderParam[];
  // Body-carrying verbs only — raw request body with {{TOKEN}} placeholders.
  bodyTemplate?: string;
  // Country calling code {{RECIPIENT_E164}} prefixes onto the stored local number.
  // Digits with an optional leading '+', max 6; defaults to '91'.
  defaultCountryCode?: string;
  // Text the provider's reply must contain for the send to count. Gateways that
  // answer HTTP 200 with an error body are billed as delivered without it. Max 200.
  successContains?: string;
  enabled?: boolean;
}

export interface MessagingProviderResponse {
  channel: MessagingChannel;
  // CAMPAIGN rows carry their owning org (null for platform default); SYSTEM rows omit both.
  usage?: ProviderUsage;
  organizationId?: number;
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
  defaultCountryCode?: string;
  successContains?: string;
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
