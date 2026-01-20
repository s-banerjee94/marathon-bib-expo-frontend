import { UserRole } from '../../core/models/user.model';
import { PageableParams } from '../../core/models/api.model';

// Roles that require organization selection
export const ROLES_REQUIRING_ORGANIZATION = [
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
  UserRole.DISTRIBUTOR,
];

// Roles that require email and phone
export const ROLES_REQUIRING_EMAIL_PHONE = [
  UserRole.ADMIN,
  UserRole.ORGANIZER_ADMIN,
  UserRole.ORGANIZER_USER,
];

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
const AUTOCOMPLETE_DELAY_MS = 600;

/**
 * Check if a role requires organization selection
 */
export function roleRequiresOrganization(role: UserRole | null): boolean {
  return role ? ROLES_REQUIRING_ORGANIZATION.includes(role) : false;
}

/**
 * Check if a role requires email and phone fields
 */
export function roleRequiresEmailPhone(role: UserRole | null): boolean {
  return role ? ROLES_REQUIRING_EMAIL_PHONE.includes(role) : false;
}

/**
 * Build pageable params for organization search
 */
export function buildOrganizationSearchParams(searchTerm?: string): PageableParams {
  return {
    page: 0,
    size: DEFAULT_PAGE_SIZE,
    search: searchTerm || undefined,
    enabled: true,
    deleted: false,
    sort: ['organizerName,desc'],
  };
}

export const SEARCH_DEBOUNCE = SEARCH_DEBOUNCE_MS;
export const DEFAULT_SEARCH_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const AUTOCOMPLETE_DELAY = AUTOCOMPLETE_DELAY_MS;
