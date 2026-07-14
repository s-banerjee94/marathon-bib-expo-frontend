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

/** Human-readable labels for each role, for display in menus and profile views. */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ROOT]: 'Root',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.ORGANIZER_ADMIN]: 'Organizer Admin',
  [UserRole.ORGANIZER_USER]: 'Organizer User',
  [UserRole.DISTRIBUTOR]: 'Distributor',
};

/** Roles that manage events, users and participants — everyone except DISTRIBUTOR. */
export const EVENT_MANAGEMENT_ROLES = [
  UserRole.ROOT,
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

/** Platform-level roles that manage organizations and billing. */
export const PLATFORM_ADMIN_ROLES = [UserRole.ROOT, UserRole.ADMIN];

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
  /** Short-lived presigned URL for the profile picture; null/undefined if none set. */
  profilePictureUrl?: string;
  organizationId?: number;
  organizationName?: string;
  /** The single event a distributor is bound to; null for every other role. */
  eventId?: number;
  eventName?: string;
  enabled: boolean;
  accountNonLocked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
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
  /** Required when role is DISTRIBUTOR — the event the distributor is bound to. */
  eventId?: number;
}

/**
 * Update User Request DTO — only profile fields (email, fullName, phoneNumber).
 * Role, username, and organization cannot be changed via this endpoint, and
 * passwords are changed only through the dedicated password endpoints.
 */
export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  phoneNumber?: string;
}

/**
 * Change Own Password Request DTO — PUT /users/me/password.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
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
 * Matches backend LoginResponse structure.
 * Access token is short-lived (15 min); refresh token is delivered as an HttpOnly cookie.
 */
export interface AuthResponse {
  accessToken: string;
  /** Access-token lifetime in milliseconds (self-documenting backend field name). */
  expiresInMs: number;
  username: string;
  role: string;
  organizationId?: number;
  id: number;
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

/**
 * Role availability map by user role
 * Defines which roles each user type can create
 * Hierarchy: ROOT > ADMIN > ORGANIZER_ADMIN > ORGANIZER_USER > DISTRIBUTOR
 */
export interface RoleOption {
  label: string;
  value: UserRole;
}

export const ROLE_AVAILABILITY: Record<UserRole, RoleOption[]> = {
  [UserRole.ROOT]: [
    { label: 'Admin', value: UserRole.ADMIN },
    { label: 'Organizer Admin', value: UserRole.ORGANIZER_ADMIN },
    { label: 'Organizer User', value: UserRole.ORGANIZER_USER },
    { label: 'Distributor', value: UserRole.DISTRIBUTOR },
  ],
  [UserRole.ADMIN]: [
    { label: 'Organizer Admin', value: UserRole.ORGANIZER_ADMIN },
    { label: 'Organizer User', value: UserRole.ORGANIZER_USER },
    { label: 'Distributor', value: UserRole.DISTRIBUTOR },
  ],
  [UserRole.ORGANIZER_ADMIN]: [
    { label: 'Organizer User', value: UserRole.ORGANIZER_USER },
    { label: 'Distributor', value: UserRole.DISTRIBUTOR },
  ],
  [UserRole.ORGANIZER_USER]: [{ label: 'Distributor', value: UserRole.DISTRIBUTOR }],
  [UserRole.DISTRIBUTOR]: [],
};
