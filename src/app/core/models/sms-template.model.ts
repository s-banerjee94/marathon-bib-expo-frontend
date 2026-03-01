/**
 * SMS Template model matching backend SmsTemplateResponse
 * Represents an SMS template for event notifications
 */
export interface SmsTemplate {
  id: number;
  name: string; // Human-readable name for the template
  smsTemplateId: string; // DLT Template ID from telecom provider
  template: string; // SMS template text with placeholders
  note?: string;
  scheduledDateTime?: string; // ISO date-time string
  enabled: boolean;
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
  scheduledDateTime?: string; // Optional: ISO date-time string
}

/**
 * Update SMS Template Request DTO (all fields optional for PATCH)
 */
export interface UpdateSmsTemplateRequest {
  name?: string; // 0-100 chars
  smsTemplateId?: string; // 20-200 chars, pattern ^[0-9]+$
  template?: string; // 2-1000 chars
  note?: string; // 0-500 chars
  scheduledDateTime?: string; // ISO date-time string
}

/**
 * Filter preferences for SMS template table (persisted to localStorage)
 */
export interface SmsTemplateFilterPrefs {
  enabled: boolean | null;
}
