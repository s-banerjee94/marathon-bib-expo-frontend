/**
 * LocalStorage keys used throughout the application
 * Centralized to avoid duplication and typos
 */

export const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN: 'marathon_auth_token',
  USER: 'marathon_user',

  // Table preferences
  USER_TABLE_COLUMNS: 'marathon_user_table_columns',
  USER_TABLE_FILTERS: 'marathon_user_table_filters',
  ORG_TABLE_COLUMNS: 'marathon_org_table_columns',
  ORG_TABLE_FILTERS: 'marathon_org_table_filters',
  EVENT_TABLE_COLUMNS: 'marathon_event_table_columns',
  EVENT_TABLE_FILTERS: 'marathon_event_table_filters',
  PARTICIPANT_TABLE_COLUMNS: 'marathon_participant_table_columns',
  PARTICIPANT_TABLE_FILTERS: 'marathon_participant_table_filters',
} as const;
