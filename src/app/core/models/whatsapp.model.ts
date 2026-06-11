export type WhatsAppSenderMode = 'DEFAULT' | 'CUSTOM';

export interface WhatsAppConfigResponse {
  configured: boolean;
  mode: WhatsAppSenderMode;
  accountSid?: string;
  authTokenMasked?: string;
  fromNumber?: string;
  verified?: boolean;
}

export interface SaveWhatsAppConfigRequest {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface UpdateWhatsAppSenderModeRequest {
  mode: WhatsAppSenderMode;
}

export interface WhatsAppTestSendRequest {
  contentSid: string;
  toNumber: string;
  // Positional Content-template values. Not yet honored by the backend test
  // endpoint; sent ahead of backend support (unknown fields are ignored).
  bodyVariables?: string[];
}
