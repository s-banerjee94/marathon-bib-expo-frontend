/**
 * Sort options for table components
 */

import { SortOption } from '../models/table-config.model';

export const USER_SORT_OPTIONS: SortOption[] = [
  { label: 'Username (A-Z)', value: 'username,asc' },
  { label: 'Username (Z-A)', value: 'username,desc' },
  { label: 'Name (A-Z)', value: 'fullName,asc' },
  { label: 'Name (Z-A)', value: 'fullName,desc' },
  { label: 'Newest First', value: 'createdAt,desc' },
  { label: 'Oldest First', value: 'createdAt,asc' },
  { label: 'Recently Updated', value: 'updatedAt,desc' },
  { label: 'Least Recently Updated', value: 'updatedAt,asc' },
];

export const ORGANIZATION_SORT_OPTIONS: SortOption[] = [
  { label: 'Name (A-Z)', value: 'organizerName,asc' },
  { label: 'Name (Z-A)', value: 'organizerName,desc' },
  { label: 'Newest First', value: 'createdAt,desc' },
  { label: 'Oldest First', value: 'createdAt,asc' },
  { label: 'Recently Updated', value: 'updatedAt,desc' },
  { label: 'Least Recently Updated', value: 'updatedAt,asc' },
];

export const EVENT_SORT_OPTIONS: SortOption[] = [
  { label: 'Event Name (A-Z)', value: 'eventName,asc' },
  { label: 'Event Name (Z-A)', value: 'eventName,desc' },
  { label: 'Start Date (Earliest)', value: 'eventStartDate,asc' },
  { label: 'Start Date (Latest)', value: 'eventStartDate,desc' },
  { label: 'End Date (Earliest)', value: 'eventEndDate,asc' },
  { label: 'End Date (Latest)', value: 'eventEndDate,desc' },
  { label: 'Newest First', value: 'createdAt,desc' },
  { label: 'Oldest First', value: 'createdAt,asc' },
  { label: 'Recently Updated', value: 'updatedAt,desc' },
  { label: 'Least Recently Updated', value: 'updatedAt,asc' },
];
