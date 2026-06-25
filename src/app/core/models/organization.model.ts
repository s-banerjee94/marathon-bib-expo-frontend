export enum SubscriptionTier {
  PAY_AS_YOU_GO = 'PAY_AS_YOU_GO',
  PREMIUM = 'PREMIUM',
  PARTNER = 'PARTNER',
}

/**
 * Read-only status derived from the tier: ACTIVE/EXPIRED for committed plans
 * (PREMIUM, PARTNER); FREE on the PAY_AS_YOU_GO baseline.
 */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  FREE = 'FREE',
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
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  billingEmail?: string;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
}

/**
 * The contact/address/business fields shared by the create dialog and the edit
 * page, rendered by the `OrganizationFieldsForm` sub-form. Both
 * `CreateOrganizationRequest` and the edit page's `details` model are structurally
 * assignable to this, so the same field markup drives both screens.
 */
export interface OrganizationFieldsModel {
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
