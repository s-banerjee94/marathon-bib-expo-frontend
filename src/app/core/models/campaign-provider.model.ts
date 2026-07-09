// Contracts for campaign sender providers (SMS/WhatsApp). The provider connection
// shape is shared with system messaging (SaveMessagingProviderRequest /
// MessagingProviderResponse in system-messaging.model.ts); this file adds the
// campaign-only bits: the test-send payload and the scope a request targets.
// Mirrors the `/v3/api-docs/10-campaign-providers` OpenAPI group.

// Campaign providers exist at two scopes: the platform default (ROOT) and a
// per-organization override. The scope selects which endpoint base path is used.
export type CampaignProviderScope = { kind: 'SYSTEM' } | { kind: 'ORG'; organizationId: number };

// Payload for POST …/campaign-providers/{channel}/test. The backend performs a live
// send through the provider and returns 200 on success, 502 on provider failure.
export interface ProviderTestSendRequest {
  // Recipient phone number, country-coded.
  recipientPhone: string;
  // Registered template id: DLT template id (SMS) or Content SID (WhatsApp).
  templateId?: string;
  // Registered DLT header / sender id.
  senderId?: string;
  // Finished message text, for client-rendered channels (SMS).
  message?: string;
  // Ordered variable values, for provider-rendered channels (WhatsApp).
  variables?: string[];
}
