/**
 * Organization table columns configuration
 * Centralized list of all available columns for organization display
 */

import { TableColumn } from '../models/table-config.model';

export const ORGANIZATION_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID', required: true, disabled: true },
  { field: 'organizerName', header: 'Organization Name', required: true, disabled: true },
  { field: 'phoneNumber', header: 'Phone', required: true, disabled: true },
  { field: 'email', header: 'Email' },
  { field: 'website', header: 'Website' },
  { field: 'addressLine1', header: 'Address Line 1' },
  { field: 'addressLine2', header: 'Address Line 2' },
  { field: 'city', header: 'City' },
  { field: 'stateProvince', header: 'State/Province' },
  { field: 'postalCode', header: 'Postal Code' },
  { field: 'country', header: 'Country' },
  { field: 'taxId', header: 'Tax ID' },
  { field: 'registrationNumber', header: 'Registration Number' },
  { field: 'maxOrganizerUsers', header: 'Max Organizer Users' },
  { field: 'maxDistributors', header: 'Max Distributors' },
  { field: 'subscriptionTier', header: 'Subscription Tier' },
  { field: 'subscriptionStatus', header: 'Subscription Status' },
  { field: 'subscriptionStartDate', header: 'Subscription Start Date' },
  { field: 'subscriptionEndDate', header: 'Subscription End Date' },
  { field: 'billingEmail', header: 'Billing Email' },
  { field: 'enabled', header: 'Enabled' },
  { field: 'deleted', header: 'Deleted' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];
