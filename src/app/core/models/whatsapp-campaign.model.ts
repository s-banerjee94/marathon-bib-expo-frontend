export type WhatsAppCampaignTriggerType = 'AUTO_BIB_COLLECTED' | 'SCHEDULED';
export type WhatsAppCampaignTargetFilter = 'ALL' | 'NOT_COLLECTED';
export type WhatsAppCampaignStatus = 'DRAFT' | 'ACTIVE' | 'SENDING' | 'SENT' | 'FAILED';

export interface WhatsAppCampaign {
  id: number;
  name: string;
  eventId: number;
  organizationId?: number;
  eventName?: string;
  whatsAppTemplateId: number;
  whatsAppTemplateName?: string;
  triggerType?: WhatsAppCampaignTriggerType;
  targetFilter?: WhatsAppCampaignTargetFilter;
  scheduledDate?: string;
  scheduledTime?: string;
  status: WhatsAppCampaignStatus;
  sentCount?: number;
  retryCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

// triggerType optional: omitting it saves the campaign as DRAFT
// targetFilter required only when triggerType is present
export interface CreateWhatsAppCampaignRequest {
  name: string;
  whatsAppTemplateId: number;
  triggerType?: WhatsAppCampaignTriggerType;
  targetFilter?: WhatsAppCampaignTargetFilter;
  scheduledDate?: string;
  scheduledTime?: string;
}

export interface UpdateWhatsAppCampaignRequest {
  name?: string;
  whatsAppTemplateId?: number;
  triggerType?: WhatsAppCampaignTriggerType;
  targetFilter?: WhatsAppCampaignTargetFilter;
  scheduledDate?: string;
  scheduledTime?: string;
}
