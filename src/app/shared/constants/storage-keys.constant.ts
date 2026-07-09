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
  RACE_TABLE_COLUMNS: 'marathon_race_table_columns',
  RACE_TABLE_FILTERS: 'marathon_race_table_filters',
  CATEGORY_TABLE_COLUMNS: 'marathon_category_table_columns',
  CATEGORY_TABLE_FILTERS: 'marathon_category_table_filters',
  SMS_TEMPLATE_TABLE_COLUMNS: 'marathon_sms_template_table_columns',
  SMS_CAMPAIGN_TABLE_COLUMNS: 'marathon_sms_campaign_table_columns',
  WHATSAPP_TEMPLATE_TABLE_COLUMNS: 'marathon_whatsapp_template_table_columns',
  WHATSAPP_CAMPAIGN_TABLE_COLUMNS: 'marathon_whatsapp_campaign_table_columns',
  BILL_TABLE_COLUMNS: 'marathon_bill_table_columns',
  BILL_TABLE_FILTERS: 'marathon_bill_table_filters',
  ORG_BILL_TABLE_COLUMNS: 'marathon_org_bill_table_columns',
  ORG_BILL_TABLE_FILTERS: 'marathon_org_bill_table_filters',

  // Layout preferences
  LAYOUT_CONFIG: 'marathon_layout_config',

  // AI assistant approval mode (ask | agent | auto)
  AI_AGENT_MODE: 'marathon_ai_agent_mode',

  // In-flight imports (for reload-proof progress widgets)
  ACTIVE_IMPORTS: 'marathon_active_imports',
} as const;
