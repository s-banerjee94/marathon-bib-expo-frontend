/**
 * SMS Template model matching backend SmsTemplateResponse
 * Represents an SMS template for event notifications
 */
export interface SmsTemplate {
  id: number;
  name: string;
  smsTemplateId: string;
  template: string;
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
  template: string; // Required: 2-1000 chars
  note?: string; // Optional: 0-500 chars
}

/**
 * Update SMS Template Request DTO (all fields optional for PATCH)
 */
export interface UpdateSmsTemplateRequest {
  name?: string; // 0-100 chars
  smsTemplateId?: string; // 20-200 chars, pattern ^[0-9]+$
  template?: string; // 2-1000 chars
  note?: string; // 0-500 chars
}
