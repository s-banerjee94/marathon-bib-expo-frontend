/**
 * Columns for the platform "All Bills" feed (GET /api/billing).
 *
 * The global feed returns bill *headers* — its `lineItems` come back empty — so
 * every column here maps to a header field. (There is no participant count in
 * this view: that lives on a bill's PARTICIPANT line item, which the feed omits.)
 */

import { TableColumn } from '../models/table-config.model';

export const BILL_COLUMNS: TableColumn[] = [
  { field: 'organizationId', header: 'Organization', required: true, disabled: true },
  { field: 'eventName', header: 'Event', required: true, disabled: true },
  { field: 'status', header: 'Status' },
  { field: 'invoiceNumber', header: 'Invoice No.' },
  { field: 'reason', header: 'Trigger' },
  { field: 'createdAt', header: 'Generated', type: 'datetime' },
  { field: 'eventDate', header: 'Event Date', type: 'date' },
  { field: 'subtotal', header: 'Subtotal' },
  { field: 'taxAmount', header: 'Tax' },
  { field: 'totalAmount', header: 'Total' },
  { field: 'paymentStatus', header: 'Payment' },
  { field: 'updatedAt', header: 'Updated', type: 'datetime' },
];

/** Fields shown by default; the rest are opt-in via the column selector. */
export const DEFAULT_BILL_COLUMN_FIELDS = [
  'organizationId',
  'eventName',
  'status',
  'reason',
  'createdAt',
  'totalAmount',
  'paymentStatus',
];

/**
 * Columns for one organization's own bills (Accounts ▸ Billing) — the platform
 * set minus the Organization column (it's a single org), so the two stay in sync.
 */
export const ORG_BILL_COLUMNS: TableColumn[] = BILL_COLUMNS.filter(
  (c) => c.field !== 'organizationId',
);

export const DEFAULT_ORG_BILL_COLUMN_FIELDS = DEFAULT_BILL_COLUMN_FIELDS.filter(
  (f) => f !== 'organizationId',
);
