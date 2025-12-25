/**
 * User Role Enum matching backend UserRole
 * Hierarchy: ROOT > ADMIN > ORGANIZER_ADMIN > ORGANIZER_USER > DISTRIBUTOR
 */
export enum UserRole {
  ROOT = 'ROOT',
  ADMIN = 'ADMIN',
  ORGANIZER_ADMIN = 'ORGANIZER_ADMIN',
  ORGANIZER_USER = 'ORGANIZER_USER',
  DISTRIBUTOR = 'DISTRIBUTOR',
}

/**
 * User model matching backend UserResponse
 */
export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  organizationId?: number;
  organizationName?: string;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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
  orgAdmin?: User;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create User Request DTO
 */
export interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  organizationId?: number;
}

/**
 * Create Organization Request DTO
 */
export interface CreateOrganizationRequest {
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
}

/**
 * Login Request
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Auth Response from API (Login Response)
 * Matches backend LoginResponse structure
 */
export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  username: string;
  role: string;
  organizationId?: number;
  id: number; // Optional - will be added in backend in future
}

/**
 * Permissions map by role
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ROOT]: [
    'manage_admins',
    'create_organizations',
    'manage_organizations',
    'view_all_analytics',
    'system_settings',
  ],
  [UserRole.ADMIN]: [
    'create_organizations',
    'manage_organizations',
    'manage_org_admins',
    'view_analytics',
  ],
  [UserRole.ORGANIZER_ADMIN]: [
    'create_org_users',
    'create_distributors',
    'manage_org_users',
    'manage_distributors',
    'view_org_analytics',
  ],
  [UserRole.ORGANIZER_USER]: ['create_distributors', 'manage_distributors'],
  [UserRole.DISTRIBUTOR]: ['view_assigned_bibs', 'manage_assigned_bibs'],
};
