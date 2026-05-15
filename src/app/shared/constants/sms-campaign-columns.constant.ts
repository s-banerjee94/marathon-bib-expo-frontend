import { TableColumn } from '../models/table-config.model';

export const SMS_CAMPAIGN_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'smsTemplateName', header: 'Template' },
  { field: 'triggerType', header: 'Trigger' },
  { field: 'targetFilter', header: 'Target' },
  { field: 'scheduledDate', header: 'Scheduled At' },
  { field: 'status', header: 'Status' },
  { field: 'sentCount', header: 'Sent Count' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

export const DEFAULT_SMS_CAMPAIGN_COLUMNS = [
  'name',
  'smsTemplateName',
  'triggerType',
  'targetFilter',
  'scheduledDate',
  'status',
  'sentCount',
];

export const SMS_CAMPAIGN_TRIGGER_OPTIONS = [
  { label: 'Auto (Bib Collected)', value: 'AUTO_BIB_COLLECTED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
];

export const SMS_CAMPAIGN_TARGET_OPTIONS = [
  { label: 'All Participants', value: 'ALL' },
  { label: 'Not Yet Collected', value: 'NOT_COLLECTED' },
];
