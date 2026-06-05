import { User } from './user.model';

export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export interface RoleQuotaRequest {
  max?: number | null;
}

export interface UserQuotaRequest {
  admins?: RoleQuotaRequest;
  organizerUsers?: RoleQuotaRequest;
  distributors?: RoleQuotaRequest;
}

export interface RoleQuota {
  max?: number;
  used?: number;
}

export interface UserQuotaDto {
  admins?: RoleQuota;
  organizerUsers?: RoleQuota;
  distributors?: RoleQuota;
}

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
  /** Short-lived presigned URL for the organization logo; null/undefined if none set. */
  logoUrl?: string;
  userQuota?: UserQuotaDto;
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
  createdBy?: string;
  lastModifiedBy?: string;
}

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
  userQuota?: UserQuotaRequest;
  subscriptionTier?: SubscriptionTier;
  billingEmail?: string;
}

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
  userQuota?: UserQuotaRequest;
  subscriptionTier?: SubscriptionTier;
  billingEmail?: string;
}
