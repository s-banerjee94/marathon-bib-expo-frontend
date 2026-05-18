import { UserRole } from '../../core/models/user.model';

export interface TableColumn {
  field: string;
  header: string;
  required?: boolean; // If true, column cannot be removed from view
  disabled?: boolean; // If true, option is disabled in dropdown
  visibleFor?: UserRole[]; // If set, column is hidden for any role not in this list
}

export interface SortOption {
  label: string;
  value: string;
}

export interface TableFilterPreferences {
  enabled?: boolean;
  sort?: string[];
  [key: string]: unknown;
}
