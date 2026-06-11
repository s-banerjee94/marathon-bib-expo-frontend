import { TableColumn } from '../models/table-config.model';

export const WHATSAPP_CAMPAIGN_COLUMNS: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name', required: true, disabled: true },
  { field: 'whatsAppTemplateName', header: 'Template' },
  { field: 'triggerType', header: 'Trigger' },
  { field: 'targetFilter', header: 'Target' },
  { field: 'scheduledDate', header: 'Scheduled At' },
  { field: 'status', header: 'Status', required: true, disabled: true },
  { field: 'sentCount', header: 'Sent Count' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

export const DEFAULT_WHATSAPP_CAMPAIGN_COLUMNS = [
  'name',
  'whatsAppTemplateName',
  'triggerType',
  'targetFilter',
  'scheduledDate',
  'status',
  'sentCount',
];
