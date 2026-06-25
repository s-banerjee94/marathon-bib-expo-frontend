/**
 * User table columns configuration
 * Centralized list of all available columns for user display
 */

import { TableColumn } from '../models/table-config.model';
import { UserRole } from '../../core/models/user.model';

export const USER_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'username', header: 'Username', required: true, disabled: true },
  { field: 'fullName', header: 'Full Name', required: true, disabled: true },
  { field: 'email', header: 'Email' },
  { field: 'phoneNumber', header: 'Phone Number' },
  { field: 'role', header: 'Role' },
  {
    field: 'organizationId',
    header: 'Organization ID',
    visibleFor: [UserRole.ROOT, UserRole.ADMIN],
  },
  {
    field: 'organizationName',
    header: 'Organization',
    required: true,
    disabled: true,
    visibleFor: [UserRole.ROOT, UserRole.ADMIN],
  },
  // Populated only for distributors (the event they're bound to); '--' otherwise.
  { field: 'eventName', header: 'Event' },
  { field: 'enabled', header: 'Enabled' },
  {
    field: 'accountNonLocked',
    header: 'Account Non-Locked',
    visibleFor: [UserRole.ROOT, UserRole.ADMIN],
  },
  { field: 'createdAt', header: 'Created At', type: 'datetime' },
  { field: 'updatedAt', header: 'Updated At', type: 'datetime' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];
