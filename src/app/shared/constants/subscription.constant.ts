/**
 * Subscription tier constants
 */

import { SubscriptionTier } from '../../core/models/organization.model';

export interface SubscriptionTierOption {
  label: string;
  value: SubscriptionTier;
}

export const SUBSCRIPTION_TIER_OPTIONS: SubscriptionTierOption[] = [
  { label: 'Free', value: SubscriptionTier.FREE },
  { label: 'Basic', value: SubscriptionTier.BASIC },
  { label: 'Premium', value: SubscriptionTier.PREMIUM },
  { label: 'Enterprise', value: SubscriptionTier.ENTERPRISE },
];
