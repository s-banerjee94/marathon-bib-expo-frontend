import {
  MessagePurpose,
  MessagingChannel,
  TemplateMode,
} from '../../core/models/system-messaging.model';

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

// Channels surfaced as tabs. EMAIL is shown but flagged `comingSoon` — its tab
// renders a placeholder until the backend supports it.
export interface ChannelMeta {
  value: MessagingChannel;
  label: string;
  icon: string;
  comingSoon?: boolean;
}

export const SYSTEM_MESSAGING_CHANNELS: ChannelMeta[] = [
  { value: 'SMS', label: 'SMS', icon: 'pi pi-comment' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'pi pi-whatsapp' },
  { value: 'EMAIL', label: 'Email', icon: 'pi pi-envelope', comingSoon: true },
];

export const DEFAULT_CHANNEL: MessagingChannel = 'SMS';

export interface PurposeMeta {
  value: MessagePurpose;
  label: string;
  description: string;
}

export const MESSAGE_PURPOSES: PurposeMeta[] = [
  { value: 'INVITE', label: 'Account Invite', description: 'Sent when a user is invited to join' },
  {
    value: 'PASSWORD_RESET',
    label: 'Password Reset',
    description: 'Sent when a user requests a password reset',
  },
  { value: 'OTP', label: 'One-Time Passcode', description: 'Sent to verify a login or action' },
];

export const HTTP_METHOD_OPTIONS: SelectOption[] = [
  { label: 'POST', value: 'POST' },
  { label: 'GET', value: 'GET' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
];

// Verbs that carry a request body — the only ones for which body format and body
// template are meaningful.
export const BODY_CARRYING_METHODS: readonly string[] = ['POST', 'PUT', 'PATCH'];

export const AUTH_TYPE_OPTIONS: SelectOption[] = [
  { label: 'API token', value: 'TOKEN' },
  { label: 'Username & password', value: 'USERNAME_PASSWORD' },
];

export const TEMPLATE_MODE_OPTIONS: SelectOption[] = [
  { label: 'Client-rendered (we build the text)', value: 'CLIENT_RENDERED' },
  { label: 'Provider-rendered (vendor template)', value: 'PROVIDER_RENDERED' },
];

export const CONTENT_TYPE_OPTIONS: SelectOption[] = [
  { label: 'JSON body', value: 'JSON' },
  { label: 'Form-encoded body', value: 'FORM' },
  { label: 'XML body', value: 'XML' },
  { label: 'Plain text body', value: 'TEXT' },
];

export const PARAM_LOCATION_OPTIONS: SelectOption[] = [
  { label: 'Header', value: 'HEADER' },
  { label: 'Query', value: 'QUERY' },
];

// Substitution tokens the backend fills at send time. Surface as inline help next
// to the request parameters and body template, where they may be embedded literally.
// `modes` / `channels` limit where a token is meaningful; omitted means "always".
// The panel dims the ones that don't apply to the current selection.
export interface ProviderToken {
  token: string;
  description: string;
  modes?: TemplateMode[];
  channels?: MessagingChannel[];
}

export const PROVIDER_TOKENS: ProviderToken[] = [
  {
    token: '{{RECIPIENT}}',
    description: 'Phone as stored (local, 10 digits)',
    channels: ['SMS', 'WHATSAPP'],
  },
  {
    token: '{{RECIPIENT_E164}}',
    description: 'Phone as +<country code><number>',
    channels: ['SMS', 'WHATSAPP'],
  },
  {
    token: '{{RECIPIENT_CC}}',
    description: 'Same, without the leading + — for gateways that reject it',
    channels: ['SMS', 'WHATSAPP'],
  },
  { token: '{{RECIPIENT_EMAIL}}', description: 'Email address', channels: ['EMAIL'] },
  { token: '{{SUBJECT}}', description: 'Subject line', channels: ['EMAIL'] },
  {
    token: '{{MESSAGE}}',
    description: 'Finished message text',
    modes: ['CLIENT_RENDERED'],
  },
  { token: '{{TEMPLATE_ID}}', description: 'DLT / Content template id' },
  { token: '{{SENDER_ID}}', description: 'DLT sender / header id' },
  {
    token: '{{VAR:0}}, {{VAR:1}}',
    description: 'Positional variables, zero-based',
    modes: ['PROVIDER_RENDERED'],
  },
  {
    token: '{{VARIABLES_JSON}}',
    description: 'Variables map with one-based keys (Twilio ContentVariables)',
    modes: ['PROVIDER_RENDERED'],
  },
  { token: '{{API_KEY}}', description: 'Stored API token' },
  { token: '{{USERNAME}} / {{PASSWORD}}', description: 'Stored credentials' },
  { token: '{{BASIC_AUTH}}', description: 'base64(user:pass) for Authorization: Basic' },
];

// {{VAR:n}} counts from 0 while {{VARIABLES_JSON}} emits keys from 1, so {{VAR:0}}
// and key "1" are the same value. Existing rows depend on it, so it is documented
// rather than fixed.
export const TOKEN_INDEXING_NOTE =
  '{{VAR:n}} counts from 0, but {{VARIABLES_JSON}} emits keys from 1 — {{VAR:0}} and key "1" are the same value.';

export const CHANNEL_DEFAULT_TEMPLATE_MODE: Record<MessagingChannel, TemplateMode> = {
  SMS: 'CLIENT_RENDERED',
  WHATSAPP: 'PROVIDER_RENDERED',
  EMAIL: 'CLIENT_RENDERED',
};

// Placeholder catalog offered per purpose. Seeded from the documented INVITE example;
// PASSWORD_RESET/OTP are best-effort and to be confirmed against the backend. Bodies
// remain free-text, so an incomplete catalog never blocks authoring.
export const SYSTEM_MESSAGE_PLACEHOLDERS: Record<MessagePurpose, SelectOption[]> = {
  INVITE: [
    { label: 'Role — #{role}', value: '#{role}' },
    { label: 'Organization — #{organizationName}', value: '#{organizationName}' },
    { label: 'Invite link — #{inviteUrl}', value: '#{inviteUrl}' },
  ],
  PASSWORD_RESET: [{ label: 'Reset link — #{resetUrl}', value: '#{resetUrl}' }],
  OTP: [{ label: 'Passcode — #{otp}', value: '#{otp}' }],
};
