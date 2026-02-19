import { DistributionAction, LogSearchType } from '../../core/models/distribution.model';

export interface LogSearchOption {
  label: string;
  value: LogSearchType;
  placeholder: string;
}

export interface LogActionOption {
  label: string;
  value: DistributionAction;
}

export const LOG_ACTION_OPTIONS: LogActionOption[] = [
  { label: 'BIB Collected', value: 'BIB_COLLECTED' },
  { label: 'BIB Undone', value: 'BIB_UNDONE' },
  { label: 'Goodies Distributed', value: 'GOODIES_DISTRIBUTED' },
  { label: 'Goodies Undone', value: 'GOODIES_UNDONE' },
];

export const LOG_SEARCH_TYPES: LogSearchOption[] = [
  { label: 'BIB Number', value: 'BIB', placeholder: 'Search by BIB number (e.g., 3001)' },
  {
    label: 'Action',
    value: 'ACTION',
    placeholder: 'e.g., BIB_COLLECTED, GOODIES_DISTRIBUTED',
  },
  {
    label: 'Performed By',
    value: 'PERFORMED_BY',
    placeholder: 'Staff username prefix (e.g., john)',
  },
  { label: 'Collector', value: 'COLLECTOR', placeholder: 'Collector name prefix (e.g., John)' },
  {
    label: 'Collector Phone',
    value: 'COLLECTOR_PHONE',
    placeholder: 'Collector phone prefix (e.g., +62)',
  },
];
