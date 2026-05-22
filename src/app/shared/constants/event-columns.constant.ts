/**
 * Event table columns configuration
 * Centralized list of all available columns for event display
 */

import { TableColumn } from '../models/table-config.model';

export const EVENT_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'eventName', header: 'Event Name', required: true, disabled: true },
  { field: 'eventDescription', header: 'Description' },
  { field: 'status', header: 'Status', required: true, disabled: true },
  { field: 'eventStartDate', header: 'Start Date', required: true, disabled: true },
  { field: 'eventEndDate', header: 'End Date', required: true, disabled: true },
  { field: 'venueName', header: 'Venue' },
  { field: 'city', header: 'City' },
  { field: 'stateProvince', header: 'State/Province' },
  { field: 'country', header: 'Country' },
  { field: 'addressLine1', header: 'Address Line 1' },
  { field: 'addressLine2', header: 'Address Line 2' },
  { field: 'postalCode', header: 'Postal Code' },
  { field: 'latitude', header: 'Latitude' },
  { field: 'longitude', header: 'Longitude' },
  { field: 'organizationId', header: 'Organization ID' },
  { field: 'eventGoodies', header: 'Event Goodies' },
  { field: 'enabled', header: 'Enabled' },
  { field: 'createdAt', header: 'Created At', type: 'datetime' },
  { field: 'updatedAt', header: 'Updated At', type: 'datetime' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];
