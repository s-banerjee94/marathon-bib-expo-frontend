/**
 * Billing models — match the OpenAPI group "6-billing"
 * (Event Billing + Billing Administration).
 *
 * A bill is per-event and moves through a two-state lifecycle:
 *  - DRAFT — a single replaceable proforma, editable (line items can be added /
 *    edited / removed), no invoice number, not payable.
 *  - FINAL — the issued, numbered, immutable tax invoice; frozen and payable.
 *
 * Money fields (subtotal / taxAmount / totalAmount) are derived server-side from
 * the line items; taxRate and currency are platform configuration.
 */

/** What triggered a bill: the automatic post-completion timer, or an on-demand request. */
export enum BillReason {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

/** Lifecycle state of a bill. */
export enum BillStatus {
  /** Replaceable proforma — editable, no number, not payable. */
  DRAFT = 'DRAFT',
  /** Issued tax invoice — numbered, immutable, payable. */
  FINAL = 'FINAL',
}

/** Generate mode: a replaceable draft, or the issued final invoice. */
export type BillGenerateMode = 'DRAFT' | 'FINAL';

/** Outcome of an on-demand generate request. */
export enum BillGenerationStatus {
  CREATED_DRAFT = 'CREATED_DRAFT',
  CREATED_FINAL = 'CREATED_FINAL',
  SKIPPED_DUPLICATE = 'SKIPPED_DUPLICATE',
  SKIPPED_NOT_BILLABLE = 'SKIPPED_NOT_BILLABLE',
  ALREADY_FINAL = 'ALREADY_FINAL',
}

/**
 * Payment state of a bill. Bills are created `UNPAID`; the only transition is a
 * manual admin action (ROOT/ADMIN) and it is only meaningful on a FINAL bill —
 * a DRAFT cannot be marked paid.
 */
export enum PaymentStatus {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

/**
 * Type of a bill line. PARTICIPANT is the system-generated participant fee
 * (one per bill); the charge kinds and DISCOUNT are user adjustments.
 */
export enum LineItemKind {
  /** The participant fee line — system-generated, one per bill, editable unit price/qty. */
  PARTICIPANT = 'PARTICIPANT',
  SMS_CAMPAIGN = 'SMS_CAMPAIGN',
  EXTRA_USER = 'EXTRA_USER',
  DISCOUNT = 'DISCOUNT',
  SURCHARGE = 'SURCHARGE',
  CUSTOM = 'CUSTOM',
}

/** One line on a bill; its `amount` feeds the bill subtotal (negative for a discount). */
export interface LineItemResponse {
  /** Line item id — use this in the update/delete line-item endpoints. */
  id: number;
  kind: LineItemKind;
  description: string;
  /** Quantity for a charge/participant line (amount = quantity × unitPrice); null on a discount. */
  quantity: number | null;
  /** Per-unit price for a charge/participant line; null on a discount. */
  unitPrice: number | null;
  /** Signed contribution to the subtotal — positive for a charge, negative for a discount. */
  amount: number;
  /** For a percentage discount, the percent applied; null for fixed amounts and other lines. */
  discountPercent: number | null;
  /** True if produced by the billing pipeline (the PARTICIPANT line). */
  systemGenerated: boolean;
}

/**
 * Body to add a line to / update a line on a DRAFT bill. Required fields depend on `kind`:
 *  - Charge (EXTRA_USER, SMS_CAMPAIGN, SURCHARGE, CUSTOM): `unitPrice` (required) and
 *    optional `quantity` (defaults to 1). Amount is computed as quantity × unitPrice —
 *    do not send `amount`.
 *  - Discount (DISCOUNT): exactly one of `amount` (fixed) or `percent` (1–100).
 *  - Updating the PARTICIPANT line: send `unitPrice` and/or `quantity`.
 */
export interface LineItemRequest {
  kind: LineItemKind;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  percent?: number;
}

/**
 * Body for PUT /api/events/{eventId}/billing/invoices/{invoiceId}/participant-line.
 * Updates the system-generated PARTICIPANT fee line on a DRAFT bill — its unit
 * price and/or quantity. Send only the field(s) to change; an omitted field keeps
 * its current value, and at least one must be provided. The line's kind and
 * description are system-managed; the amount recomputes as quantity × unitPrice.
 * (A later count refresh keeps an overridden unit price but resets the quantity
 * to the real participant count.)
 */
export interface ParticipantLineRequest {
  unitPrice?: number;
  quantity?: number;
}

/** One bill for an event: header totals plus the line items that make them up. */
export interface BillResponse {
  billId: string;
  status: BillStatus;
  /** GST tax-invoice serial; null while the bill is a draft. */
  invoiceNumber: string | null;
  /** Event ID this bill belongs to (string in the API payload). */
  eventId: string;
  organizationId: number;
  eventName: string;
  /** Event start date captured at generation time (ISO-8601 instant). */
  eventDate: string;
  /** Charge before tax — the sum of every line item (charges minus discounts). */
  subtotal: number;
  /** GST rate applied (percent). */
  taxRate: number;
  taxAmount: number;
  /** Total payable (subtotal + tax). */
  totalAmount: number;
  currency: string;
  /** When the bill was generated (ISO-8601 instant). */
  createdAt: string;
  /** When the bill was last modified (ISO-8601 instant), or null if never edited. */
  updatedAt: string | null;
  reason: BillReason;
  /** Payment state — only meaningful on a FINAL bill (a DRAFT cannot be marked paid). */
  paymentStatus: PaymentStatus;
  /** All line items, oldest first, including the system PARTICIPANT fee line. */
  lineItems: LineItemResponse[];
  /** Short-lived presigned PDF URL. Normally null — PDF is rendered on the frontend. */
  downloadUrl: string | null;
}

/** Body for PATCH /api/billing/{billId}/payment-status. */
export interface UpdatePaymentStatusRequest {
  paymentStatus: PaymentStatus;
}

/** Result of an on-demand bill request, with the event's refreshed bill list. */
export interface BillGenerationResponse {
  status: BillGenerationStatus;
  message: string;
  /** All bills for the event, newest first, after the request. */
  bills: BillResponse[];
}

// ── Organization-level rollup (GET /api/organizations/{id}/billing) ──

/** Every bill for one organization, across all its events. */
export interface OrganizationBillingResponse {
  organizationId: number;
  currency: string;
  /** Sum of `totalAmount` across all bills. */
  totalBilled: number;
  /** Bills newest first. */
  bills: BillResponse[];
}

// ── Platform-wide console (ROOT/ADMIN) ──

/** Query for the global, paginated bill list (GET /api/billing). */
export interface BillSearchParams {
  page?: number;
  size?: number;
  /** Spring Data sort tokens, e.g. `createdAt,desc`. */
  sort?: string[];
  organizationId?: number;
  eventId?: number;
  /** Inclusive ISO-8601 date range on `createdAt`. */
  from?: string;
  to?: string;
  reason?: BillReason;
  paymentStatus?: PaymentStatus;
  /** Free-text on organizer / event name. */
  q?: string;
}

/**
 * Auditor-grade billing statistics (GET /api/billing/stats).
 *
 * Computed entirely in a dedicated Lambda (never in Spring) and read from a
 * precomputed snapshot, sliced to the requested `range`. **Only FINAL bills
 * count** — drafts are excluded from every figure. Within a range the cohort
 * reconciles: `billed = collected + outstanding` (both amount and count).
 */

/** Range window for the stats — a rolling floor on the bill's finalize date. */
export type BillStatsRange = 'ALL' | 'YEAR' | 'MONTH';

/** What last triggered a snapshot recompute. */
export type BillStatsComputedBy = 'FINALIZE' | 'PAYMENT' | 'MANUAL';

/** A money amount and the number of bills it covers. */
export interface MoneyStat {
  amount: number;
  count: number;
}

/** Billed totals split into gross / net (taxable value) / GST. */
export interface BilledStat {
  /** Gross billed — net + tax. */
  amount: number;
  /** Net billed — taxable value, before GST. */
  net: number;
  /** GST billed. */
  tax: number;
  count: number;
}

/** GST liability split by whether the bill it sits on has been collected. */
export interface GstStat {
  collected: number;
  outstanding: number;
  total: number;
}

/** One receivables-aging band of the outstanding bills, by age since finalize. */
export interface AgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
  count: number;
}

/**
 * Billed-vs-collected over the last 12 months. Always the last 12 months,
 * independent of the selected range. All arrays are index-aligned, oldest first.
 */
export interface BillStatsTrend {
  interval: 'MONTH';
  /** Month labels (yyyy-MM), oldest first. */
  bucketLabels: string[];
  /** Gross billed per month, by finalize date. */
  billed: number[];
  /** Gross collected per month, by payment date. */
  collected: number[];
  /** Bills finalized per month. */
  count: number[];
}

/** One organization's billed/collected/outstanding rollup for the leaderboard. */
export interface TopOrganizationBilling {
  organizationId: number;
  organizerName: string;
  billed: number;
  collected: number;
  outstanding: number;
  billsCount: number;
}

/** Query for GET /api/billing/stats. */
export interface BillStatsParams {
  range?: BillStatsRange;
}

/** Auditor-grade billing statistics for one range window. */
export interface BillStatsResponse {
  currency: string;
  range: BillStatsRange;
  /** When the Lambda last computed the snapshot; null if never computed (empty state). */
  refreshedAt: string | null;
  /** What last triggered the recompute; null if never computed. */
  computedBy: BillStatsComputedBy | null;

  billed: BilledStat;
  /** PAID part of the cohort. */
  collected: MoneyStat;
  /** UNPAID part of the cohort — the open receivable. */
  outstanding: MoneyStat;

  /** Percent — `collected.amount / billed.amount × 100`. */
  collectionRate: number;
  /** `billed.amount / billed.count`. */
  averageBill: number;
  /** Days sales outstanding — average age in days of the unpaid bills. */
  dso: number;

  gst: GstStat;
  /** Billed amount + count split by trigger; both keys are always present. */
  byReason: Record<'AUTO' | 'MANUAL', MoneyStat>;
  /** Outstanding split into 0-30 / 31-60 / 61-90 / 90+ day bands. */
  aging: AgingBucket[];
  trend: BillStatsTrend;
  topOrganizations: TopOrganizationBilling[];
}

/** Ack of POST /api/billing/stats/refresh (the recompute runs asynchronously). */
export interface BillStatsRefreshResponse {
  /** The snapshot's CURRENT (pre-refresh) timestamp; null if never computed. */
  refreshedAt: string | null;
  message: string;
}
