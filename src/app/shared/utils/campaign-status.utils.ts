export type CampaignStatusSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

// Shared status → tag severity mapping for SMS/WhatsApp campaigns
// (DRAFT | ACTIVE | SENDING | SENT | FAILED).
export function getCampaignStatusSeverity(status: string): CampaignStatusSeverity {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'SENDING':
    case 'SENT':
      return 'info';
    case 'FAILED':
      return 'danger';
    default:
      return 'secondary';
  }
}
