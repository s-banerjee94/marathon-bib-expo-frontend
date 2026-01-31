export interface TableColumn {
  field: string;
  header: string;
  required?: boolean; // If true, column cannot be removed from view
  disabled?: boolean; // If true, option is disabled in dropdown
}

export interface SortOption {
  label: string;
  value: string;
}

export interface TableConfig {
  storageKeyPrefix: string;
  defaultPageSize?: number;
  enableSearch?: boolean;
  searchMinChars?: number;
  searchDebounceMs?: number;
  enableFilters?: boolean;
  enableSort?: boolean;
  enableColumnSelection?: boolean;
}

export interface TableFilterPreferences {
  enabled?: boolean;
  deleted?: boolean;
  sort?: string[];
  [key: string]: unknown;
}
