import { TableColumn } from '../models/table-config.model';
import { SortOption } from '../models/table-config.model';

/**
 * Column definitions for race table
 * Defines which columns are available and their properties
 * Per Swagger: RaceResponse does not include deleted/enabled fields
 */
export const RACE_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'raceName', header: 'Race Name' },
  { field: 'raceDescription', header: 'Description' },
  { field: 'categoryCount', header: 'Categories' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

/**
 * Sort options for race dropdown
 */
export const RACE_SORT_OPTIONS: SortOption[] = [
  { label: 'Name (A-Z)', value: 'raceName,asc' },
  { label: 'Name (Z-A)', value: 'raceName,desc' },
  { label: 'Newest First', value: 'createdAt,desc' },
  { label: 'Oldest First', value: 'createdAt,asc' },
  { label: 'Recently Updated', value: 'updatedAt,desc' },
  { label: 'Least Recently Updated', value: 'updatedAt,asc' },
];
