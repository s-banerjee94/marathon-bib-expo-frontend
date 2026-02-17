import { TableColumn } from '../models/table-config.model';

/**
 * SMS Template table column definitions
 */
export const SMS_TEMPLATE_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'smsTemplateId', header: 'DLT Template ID' },
  { field: 'template', header: 'Template' },
  { field: 'note', header: 'Note' },
  { field: 'scheduledDateTime', header: 'Scheduled Date/Time' },
  { field: 'enabled', header: 'Enabled' },
  { field: 'eventName', header: 'Event Name' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

/**
 * Default visible SMS template columns
 */
export const DEFAULT_SMS_TEMPLATE_COLUMNS = [
  'smsTemplateId',
  'template',
  'enabled',
  'scheduledDateTime',
  'createdAt',
];

/**
 * SMS Template sort options for dropdown
 */
export const SMS_TEMPLATE_SORT_OPTIONS = [
  { label: 'DLT ID (A-Z)', value: 'smsTemplateId,asc' },
  { label: 'DLT ID (Z-A)', value: 'smsTemplateId,desc' },
  { label: 'Scheduled (Earliest First)', value: 'scheduledDateTime,asc' },
  { label: 'Scheduled (Latest First)', value: 'scheduledDateTime,desc' },
  { label: 'Created (Newest First)', value: 'createdAt,desc' },
  { label: 'Created (Oldest First)', value: 'createdAt,asc' },
  { label: 'Updated (Recently Updated)', value: 'updatedAt,desc' },
  { label: 'Updated (Least Recently)', value: 'updatedAt,asc' },
];
