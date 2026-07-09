import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { PageableResponse } from '../models/api.model';
import {
  BillGenerateMode,
  BillGenerationResponse,
  BillResponse,
  BillSearchParams,
  BillStatsParams,
  BillStatsRefreshResponse,
  BillStatsResponse,
  LineItemRequest,
  OrganizationBillingResponse,
  ParticipantLineRequest,
  PaymentStatus,
} from '../models/billing.model';

/**
 * Billing API across three scopes:
 *  - per-event   (exists today): generate + list a single event's bills
 *  - per-org     (Phase 2):      one organization's bills rolled up
 *  - platform    (Phase 3):      global paginated list + summary (ROOT/ADMIN)
 *
 * All endpoints are role-restricted on the backend. Auth header is added by authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);
  private eventsUrl = `${BASE_URI}/events`;
  private orgsUrl = `${BASE_URI}/organizations`;
  private billingUrl = `${BASE_URI}/billing`;

  // ── Per-event ──────────────────────────────────────────────────────────────

  /** Every bill for the event, newest first; each carries a presigned PDF `downloadUrl`. */
  listBills(eventId: number): Observable<BillResponse[]> {
    return this.http.get<BillResponse[]>(`${this.eventsUrl}/${eventId}/billing`);
  }

  /**
   * Generate a bill on demand. The event must be COMPLETED or CANCELLED (else 400).
   *  - `DRAFT` (default) produces/refreshes the event's single replaceable proforma.
   *  - `FINAL` issues the numbered, immutable tax invoice and closes the event to
   *    further billing (ROOT/ADMIN only; an ORGANIZER_ADMIN request is treated as DRAFT).
   * The response carries the refreshed bill list, so callers can patch in place.
   */
  generateBill(
    eventId: number,
    mode: BillGenerateMode = 'DRAFT',
  ): Observable<BillGenerationResponse> {
    const params = new HttpParams().set('mode', mode);
    return this.http.post<BillGenerationResponse>(
      `${this.eventsUrl}/${eventId}/billing/generate`,
      {},
      { params },
    );
  }

  // ── Draft line items (DRAFT bills only, ROOT/ADMIN) ──────────────────────────
  // Each call returns the whole refreshed bill with recomputed totals.

  /** Add one charge or discount line to a draft bill. */
  addLineItem(eventId: number, billId: string, body: LineItemRequest): Observable<BillResponse> {
    return this.http.post<BillResponse>(
      `${this.eventsUrl}/${eventId}/billing/invoices/${billId}/line-items`,
      body,
    );
  }

  /**
   * Replace the values of one **manual** line (a charge or discount) on a draft bill.
   * The system-generated PARTICIPANT line is edited via `updateParticipantLine`, not
   * here — passing it to this endpoint returns 400.
   */
  updateLineItem(
    eventId: number,
    billId: string,
    lineItemId: number,
    body: LineItemRequest,
  ): Observable<BillResponse> {
    return this.http.put<BillResponse>(
      `${this.eventsUrl}/${eventId}/billing/invoices/${billId}/line-items/${lineItemId}`,
      body,
    );
  }

  /**
   * Update the system-generated PARTICIPANT fee line on a draft bill — its unit
   * price and/or quantity (send at least one; an omitted field keeps its current
   * value). The line's kind and description are system-managed. Manual charge /
   * discount lines use `updateLineItem`; this endpoint is PARTICIPANT-only.
   */
  updateParticipantLine(
    eventId: number,
    billId: string,
    body: ParticipantLineRequest,
  ): Observable<BillResponse> {
    return this.http.put<BillResponse>(
      `${this.eventsUrl}/${eventId}/billing/invoices/${billId}/participant-line`,
      body,
    );
  }

  /** Remove one line from a draft bill (the PARTICIPANT / system lines cannot be removed). */
  deleteLineItem(eventId: number, billId: string, lineItemId: number): Observable<BillResponse> {
    return this.http.delete<BillResponse>(
      `${this.eventsUrl}/${eventId}/billing/invoices/${billId}/line-items/${lineItemId}`,
    );
  }

  // ── Per-organization (Phase 2) ───────────────────────────────────────────────

  /** All bills for one organization, with the org's total billed. */
  getOrganizationBilling(organizationId: number): Observable<OrganizationBillingResponse> {
    return this.http.get<OrganizationBillingResponse>(`${this.orgsUrl}/${organizationId}/billing`);
  }

  // ── Platform-wide (Phase 3, ROOT/ADMIN) ──────────────────────────────────────

  /** Global, paginated, filterable bill list. */
  searchBills(params: BillSearchParams): Observable<PageableResponse<BillResponse>> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.sort) params.sort.forEach((s) => (httpParams = httpParams.append('sort', s)));
    if (params.organizationId !== undefined)
      httpParams = httpParams.set('organizationId', params.organizationId.toString());
    if (params.eventId !== undefined)
      httpParams = httpParams.set('eventId', params.eventId.toString());
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.reason) httpParams = httpParams.set('reason', params.reason);
    if (params.paymentStatus) httpParams = httpParams.set('paymentStatus', params.paymentStatus);
    if (params.q) httpParams = httpParams.set('q', params.q.trim());

    return this.http.get<PageableResponse<BillResponse>>(this.billingUrl, { params: httpParams });
  }

  /**
   * Manually settle a bill (ROOT/ADMIN). Payment is **one-way**: bills start
   * UNPAID and `PAID` is permanent — the backend rejects PAID→UNPAID with 400,
   * and only FINAL bills are payable (a DRAFT is 400). The UNPAID→PAID transition
   * stamps the collection date and triggers an async stats recompute. Returns the
   * updated bill.
   */
  updatePaymentStatus(billId: string, paymentStatus: PaymentStatus): Observable<BillResponse> {
    return this.http.patch<BillResponse>(`${this.billingUrl}/${billId}/payment-status`, {
      paymentStatus,
    });
  }

  /**
   * Auditor-grade billing statistics for the admin overview, served from a
   * Lambda-computed snapshot sliced to `range`. Returns 200 with zeroed figures
   * and `refreshedAt: null` if the snapshot has never been computed.
   */
  getBillStats(range: BillStatsParams['range'] = 'ALL'): Observable<BillStatsResponse> {
    const params = new HttpParams().set('range', range ?? 'ALL');
    return this.http.get<BillStatsResponse>(`${this.billingUrl}/stats`, { params });
  }

  /**
   * Trigger an asynchronous recompute of the stats snapshot. Returns 202 with the
   * snapshot's pre-refresh timestamp; the new figures land a moment later, so
   * re-call `getBillStats` after a short delay to pick them up.
   */
  refreshBillStats(): Observable<BillStatsRefreshResponse> {
    return this.http.post<BillStatsRefreshResponse>(`${this.billingUrl}/stats/refresh`, {});
  }
}
