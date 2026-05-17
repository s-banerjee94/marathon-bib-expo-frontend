/**
 * User table columns configuration
 * Centralized list of all available columns for user display
 */

import { TableColumn } from '../models/table-config.model';

export const USER_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'username', header: 'Username', required: true, disabled: true },
  { field: 'fullName', header: 'Full Name', required: true, disabled: true },
  { field: 'email', header: 'Email' },
  { field: 'phoneNumber', header: 'Phone Number' },
  { field: 'role', header: 'Role' },
  { field: 'organizationId', header: 'Organization ID' },
  { field: 'organizationName', header: 'Organization', required: true, disabled: true },
  { field: 'enabled', header: 'Enabled' },
  { field: 'deleted', header: 'Deleted' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];
