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
];

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
];

export const PARAM_LOCATION_OPTIONS: SelectOption[] = [
  { label: 'Header', value: 'HEADER' },
  { label: 'Query', value: 'QUERY' },
];

// Substitution tokens the backend fills at send time. Surface as inline help next
// to the request parameters and body template, where they may be embedded literally.
export interface ProviderToken {
  token: string;
  description: string;
}

export const PROVIDER_TOKENS: ProviderToken[] = [
  { token: '{{RECIPIENT}}', description: 'Bare 10-digit phone number' },
  { token: '{{RECIPIENT_E164}}', description: 'Phone in +91… E.164 form' },
  { token: '{{MESSAGE}}', description: 'Rendered message text' },
  { token: '{{TEMPLATE_ID}}', description: 'DLT / Content template id' },
  { token: '{{SENDER_ID}}', description: 'DLT sender / header id' },
  { token: '{{VAR:0}}, {{VAR:1}}', description: 'Positional variables' },
  { token: '{{VARIABLES_JSON}}', description: 'Variables map (Twilio ContentVariables)' },
  { token: '{{API_KEY}}', description: 'Stored API token' },
  { token: '{{USERNAME}} / {{PASSWORD}}', description: 'Stored credentials' },
  { token: '{{BASIC_AUTH}}', description: 'base64(user:pass) for Authorization: Basic' },
];

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
