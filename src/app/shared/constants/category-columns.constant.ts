import { TableColumn } from '../models/table-config.model';
import { SortOption } from '../models/table-config.model';

/**
 * Column definitions for category table
 * Defines which columns are available and their properties
 */
export const CATEGORY_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'categoryName', header: 'Category Name' },
  { field: 'description', header: 'Description' },
  { field: 'raceId', header: 'Race ID' },
  { field: 'eventId', header: 'Event ID' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

/**
 * Sort options for category dropdown
 */
export const CATEGORY_SORT_OPTIONS: SortOption[] = [
  { label: 'Name (A-Z)', value: 'categoryName,asc' },
  { label: 'Name (Z-A)', value: 'categoryName,desc' },
  { label: 'Newest First', value: 'createdAt,desc' },
  { label: 'Oldest First', value: 'createdAt,asc' },
  { label: 'Recently Updated', value: 'updatedAt,desc' },
  { label: 'Least Recently Updated', value: 'updatedAt,asc' },
];
