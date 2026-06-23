/**
 * Subscription tier constants
 */

import { SubscriptionTier } from '../../core/models/organization.model';

export interface SubscriptionTierOption {
  label: string;
  value: SubscriptionTier;
}

export const SUBSCRIPTION_TIER_OPTIONS: SubscriptionTierOption[] = [
  { label: 'Pay As You Go', value: SubscriptionTier.PAY_AS_YOU_GO },
  { label: 'Premium', value: SubscriptionTier.PREMIUM },
  { label: 'Partner', value: SubscriptionTier.PARTNER },
];
