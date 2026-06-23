type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

// Title-cases a screaming-snake key (ACTIVE → Active, PAST_DUE → Past Due).
function titleCase(key: string): string {
  return key
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * PrimeNG tag severity for a subscription status. Backend currently emits
 * ACTIVE, EXPIRED and FREE; the others are handled so no rework is needed if
 * the lifecycle grows (e.g. an automatic-expiry/trial job lands later).
 */
export function getSubscriptionStatusSeverity(status?: string | null): TagSeverity {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return 'success';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'danger';
    case 'TRIAL':
      return 'info';
    case 'PENDING':
      return 'warn';
    case 'FREE':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/** Human-readable subscription status label (Active / Expired / Free). */
export function getSubscriptionStatusLabel(status?: string | null): string {
  return status ? titleCase(status) : '--';
}

/** PrimeNG tag severity for a subscription tier (PAY_AS_YOU_GO/PREMIUM/PARTNER). */
export function getSubscriptionTierSeverity(tier?: string | null): TagSeverity {
  switch (tier?.toUpperCase()) {
    case 'PARTNER':
      return 'warn';
    case 'PREMIUM':
      return 'success';
    case 'PAY_AS_YOU_GO':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/** Human-readable subscription tier label (Pay As You Go / Premium / Partner). */
export function getSubscriptionTierLabel(tier?: string | null): string {
  return tier ? titleCase(tier) : '--';
}
