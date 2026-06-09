import {
  BillReason,
  BillResponse,
  BillStatus,
  LineItemKind,
  LineItemResponse,
  PaymentStatus,
} from '../../core/models/billing.model';

/** PrimeNG tag severity for a bill's payment state. */
export function paymentStatusSeverity(status: PaymentStatus | undefined): 'success' | 'warn' {
  return status === PaymentStatus.PAID ? 'success' : 'warn';
}

/** Human-readable label for what triggered a bill. */
export function billReasonLabel(reason: BillReason): string {
  return reason === BillReason.AUTO ? 'Automatic' : 'Manual';
}

/** PrimeNG tag severity for a bill's trigger. */
export function billReasonSeverity(reason: BillReason): 'info' | 'secondary' {
  return reason === BillReason.AUTO ? 'info' : 'secondary';
}

/**
 * Tailwind alignment for a bill column: money right-aligned, tag/status columns
 * centered, everything else default. Shared by the platform and org bill tables.
 */
export function billColumnAlignment(field: string): string {
  if (field === 'subtotal' || field === 'taxAmount' || field === 'totalAmount') return 'text-right';
  if (field === 'status' || field === 'reason' || field === 'paymentStatus') return 'text-center';
  return '';
}

/** Human-readable label; treats a missing value as Unpaid (bills default to UNPAID). */
export function paymentStatusLabel(status: PaymentStatus | undefined): string {
  return status === PaymentStatus.PAID ? 'Paid' : 'Unpaid';
}

/** PrimeNG tag severity for a bill's lifecycle status. */
export function billStatusSeverity(status: BillStatus | undefined): 'info' | 'secondary' {
  return status === BillStatus.FINAL ? 'info' : 'secondary';
}

/** Human-readable lifecycle label. */
export function billStatusLabel(status: BillStatus | undefined): string {
  return status === BillStatus.FINAL ? 'Final' : 'Draft';
}

/** A FINAL bill is frozen; only drafts can be edited (and a final is what's payable). */
export function isDraft(bill: Pick<BillResponse, 'status'> | undefined): boolean {
  return bill?.status === BillStatus.DRAFT;
}

/** Human-readable label for a line item kind. */
export function lineItemKindLabel(kind: LineItemKind): string {
  switch (kind) {
    case LineItemKind.PARTICIPANT:
      return 'Participant fee';
    case LineItemKind.SMS_CAMPAIGN:
      return 'SMS campaign';
    case LineItemKind.EXTRA_USER:
      return 'Extra users';
    case LineItemKind.DISCOUNT:
      return 'Discount';
    case LineItemKind.SURCHARGE:
      return 'Surcharge';
    case LineItemKind.CUSTOM:
      return 'Custom';
  }
}

/**
 * Participant count for a bill — read off the system-generated PARTICIPANT line
 * (the count moved out of the bill header into its line item). Null when the
 * bill has no participant line yet.
 */
export function participantCountOf(bill: Pick<BillResponse, 'lineItems'>): number | null {
  const line = bill.lineItems?.find((li) => li.kind === LineItemKind.PARTICIPANT);
  return line?.quantity ?? null;
}

/**
 * A line is editable only on a draft, and only if it is user-added or the single
 * editable system line (PARTICIPANT). Other system-managed lines are frozen.
 */
export function isLineEditable(line: LineItemResponse): boolean {
  return line.kind === LineItemKind.PARTICIPANT || !line.systemGenerated;
}

/** A line is removable only if it is user-added (the PARTICIPANT / system lines stay). */
export function isLineRemovable(line: LineItemResponse): boolean {
  return line.kind !== LineItemKind.PARTICIPANT && !line.systemGenerated;
}
