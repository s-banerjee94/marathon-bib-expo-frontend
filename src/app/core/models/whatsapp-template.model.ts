export interface WhatsAppTemplate {
  id: number;
  name: string;
  contentSid: string;
  body?: string;
  bodyVariables?: string[];
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
