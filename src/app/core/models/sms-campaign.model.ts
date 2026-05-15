export type SmsCampaignTriggerType = 'AUTO_BIB_COLLECTED' | 'SCHEDULED';
export type SmsCampaignTargetFilter = 'ALL' | 'NOT_COLLECTED';
export type SmsCampaignStatus = 'DRAFT' | 'ACTIVE' | 'SENDING' | 'SENT' | 'FAILED';

export interface SmsCampaign {
  id: number;
  name: string;
  eventId: number;
  eventName?: string;
  smsTemplateId: number;
  smsTemplateName?: string;
  triggerType?: SmsCampaignTriggerType;
  targetFilter?: SmsCampaignTargetFilter;
  scheduledDate?: string;
  scheduledTime?: string;
  status: SmsCampaignStatus;
  sentCount?: number;
  retryCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

// triggerType optional: omitting it saves campaign as DRAFT
// targetFilter required only when triggerType is present
export interface CreateSmsCampaignRequest {
  name: string;
  smsTemplateId: number;
  triggerType?: SmsCampaignTriggerType;
  targetFilter?: SmsCampaignTargetFilter;
  scheduledDate?: string;
  scheduledTime?: string;
}

export interface UpdateSmsCampaignRequest {
  name?: string;
  smsTemplateId?: number;
  triggerType?: SmsCampaignTriggerType;
  targetFilter?: SmsCampaignTargetFilter;
  scheduledDate?: string;
  scheduledTime?: string;
}
