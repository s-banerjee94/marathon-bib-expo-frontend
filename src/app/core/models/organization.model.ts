import { User } from './user.model';

/**
 * Subscription Tier Enum
 */
export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * Organization model matching backend OrganizationResponse
 */
export interface Organization {
  id: number;
  organizerName: string;
  email: string;
  phoneNumber: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
  maxOrganizerUsers?: number;
  maxDistributors?: number;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  billingEmail?: string;
  orgAdmin?: User;
  enabled: boolean;
  deleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create Organization Request DTO
 */
export interface CreateOrganizationRequest {
  organizerName: string;
  email: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
  maxOrganizerUsers?: number;
  maxDistributors?: number;
  subscriptionTier?: SubscriptionTier;
  billingEmail?: string;
}

/**
 * Update Organization Request DTO (all fields optional for PATCH)
 */
export interface UpdateOrganizationRequest {
  organizerName?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
  maxOrganizerUsers?: number;
  maxDistributors?: number;
  subscriptionTier?: SubscriptionTier;
  billingEmail?: string;
}
