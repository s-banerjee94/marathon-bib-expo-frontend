import { TableColumn } from '../models/table-config.model';

export const WHATSAPP_TEMPLATE_COLUMNS: TableColumn[] = [
  { field: 'name', header: 'Name', required: true, disabled: true },
  { field: 'contentSid', header: 'Content SID', required: true, disabled: true },
  { field: 'body', header: 'Body' },
  { field: 'bodyVariables', header: 'Variables' },
  { field: 'note', header: 'Note' },
  { field: 'createdAt', header: 'Created At' },
  { field: 'updatedAt', header: 'Updated At' },
  { field: 'createdBy', header: 'Created By' },
  { field: 'lastModifiedBy', header: 'Last Modified By' },
];

export const DEFAULT_WHATSAPP_TEMPLATE_COLUMNS = ['name', 'contentSid', 'body', 'bodyVariables'];
