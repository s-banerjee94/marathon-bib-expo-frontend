import { TableColumn } from '../models/table-config.model';

/**
 * SMS Template table column definitions
 */
export const SMS_TEMPLATE_COLUMNS: TableColumn[] = [
  { field: 'name', header: 'Name', required: true, disabled: true },
  { field: 'smsTemplateId', header: 'DLT Template ID' },
  { field: 'senderId', header: 'Sender ID' },
  { field: 'template', header: 'Template', required: true, disabled: true },
  { field: 'note', header: 'Note' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

/**
 * Default visible SMS template columns
 */
export const DEFAULT_SMS_TEMPLATE_COLUMNS = [
  'name',
  'smsTemplateId',
  'senderId',
  'template',
  'note',
];

/**
 * SMS Template sort options for dropdown
 */
export const SMS_TEMPLATE_SORT_OPTIONS = [
  { label: 'DLT ID (A-Z)', value: 'smsTemplateId,asc' },
  { label: 'DLT ID (Z-A)', value: 'smsTemplateId,desc' },
  { label: 'Created (Newest First)', value: 'createdAt,desc' },
  { label: 'Created (Oldest First)', value: 'createdAt,asc' },
  { label: 'Updated (Recently Updated)', value: 'updatedAt,desc' },
  { label: 'Updated (Least Recently)', value: 'updatedAt,asc' },
];
