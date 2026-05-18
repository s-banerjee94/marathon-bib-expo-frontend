/**
 * Role filter options for user-list filtering.
 *
 * FULL — visible to ROOT and ADMIN; can filter by any role across the system.
 * ORG  — visible to ORGANIZER_ADMIN / ORGANIZER_USER; only org-level roles
 *        since backend scopes their results to their own organization.
 */

import { RoleOption, UserRole } from '../../core/models/user.model';

export const FULL_ROLE_FILTER_OPTIONS: RoleOption[] = [
  { label: 'Root', value: UserRole.ROOT },
  { label: 'Admin', value: UserRole.ADMIN },
  { label: 'Organizer Admin', value: UserRole.ORGANIZER_ADMIN },
  { label: 'Organizer User', value: UserRole.ORGANIZER_USER },
  { label: 'Distributor', value: UserRole.DISTRIBUTOR },
];

export const ORG_ROLE_FILTER_OPTIONS: RoleOption[] = [
  { label: 'Organizer Admin', value: UserRole.ORGANIZER_ADMIN },
  { label: 'Organizer User', value: UserRole.ORGANIZER_USER },
  { label: 'Distributor', value: UserRole.DISTRIBUTOR },
];
