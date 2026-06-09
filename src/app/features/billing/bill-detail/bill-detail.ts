import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  BillResponse,
  BillStatus,
  LineItemKind,
  LineItemRequest,
  LineItemResponse,
  ParticipantLineRequest,
  PaymentStatus,
} from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../shared/constants/form.constants';
import { formatMoney } from '../../../shared/utils/currency.utils';
import {
  billStatusLabel,
  billStatusSeverity,
  isDraft,
  isLineEditable,
  isLineRemovable,
  lineItemKindLabel,
  paymentStatusLabel,
  paymentStatusSeverity,
} from '../../../shared/utils/billing.utils';

type DiscountMode = 'PERCENT' | 'AMOUNT';

/**
 * Reusable invoice panel: a single bill's summary, line items and totals. For a
 * DRAFT bill and a ROOT/ADMIN user (`canManage`) the line items can be added,
 * edited or removed, the payment status toggled, and the bill issued as a final.
 * Every mutation returns the refreshed bill, emitted via `billChange` so the host
 * can patch in place (no refetch). Rendered inline on the event Bills tab and
 * inside `BillDetailDialog` from the org / platform bill tables.
 */
@Component({
  selector: 'app-bill-detail',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SelectModule,
    SelectButtonModule,
    InputTextModule,
    InputNumberModule,
    TooltipModule,
    ConfirmPopupModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './bill-detail.html',
  styleUrl: './bill-detail.css',
})
export class BillDetail {
  bill = input<BillResponse | null>(null);
  /** Event the bill belongs to — only needed for the line-item edit endpoints. */
  eventId = input<number>(0);
  canManage = input<boolean>(false);

  /** Emitted with the refreshed bill after any mutation, so the host can patch in place. */
  billChange = output<BillResponse>();
  /** Emitted when the user confirms issuing the final invoice (host runs generate FINAL). */
  issueFinal = output<void>();

  private billingService = inject(BillingService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private confirmationService = inject(ConfirmationService);

  protected readonly inputSize = FORM_INPUT_SIZE;
  protected readonly buttonSize = BUTTON_SIZE;

  protected readonly formatMoney = formatMoney;
  protected readonly kindLabel = lineItemKindLabel;
  protected readonly statusLabel = billStatusLabel;
  protected readonly statusSeverity = billStatusSeverity;
  protected readonly paymentLabel = paymentStatusLabel;
  protected readonly paymentSeverity = paymentStatusSeverity;
  protected readonly lineEditable = isLineEditable;
  protected readonly lineRemovable = isLineRemovable;
  protected readonly LineItemKind = LineItemKind;
  protected readonly BillStatus = BillStatus;
  protected readonly PaymentStatus = PaymentStatus;

  /** Line items are only editable on a draft, and only by ROOT/ADMIN. */
  protected readonly editable = computed(
    () => this.canManage() && isDraft(this.bill() ?? undefined),
  );
  protected readonly lineItems = computed(() => this.bill()?.lineItems ?? []);

  // ── Inline add/edit form (template-driven) ──────────────────────────────────
  protected readonly formOpen = signal(false);
  protected readonly editingLine = signal<LineItemResponse | null>(null);
  protected readonly saving = signal(false);
  protected readonly removingId = signal<number | null>(null);
  protected readonly updatingPayment = signal(false);

  protected formKind: LineItemKind = LineItemKind.EXTRA_USER;
  protected formDescription = '';
  protected formQuantity: number | null = 1;
  protected formUnitPrice: number | null = null;
  protected formDiscountMode: DiscountMode = 'PERCENT';
  protected formPercent: number | null = null;
  protected formAmount: number | null = null;

  // PARTICIPANT is system-generated and cannot be added as a new line.
  protected readonly kindOptions = [
    { label: 'Extra users', value: LineItemKind.EXTRA_USER },
    { label: 'SMS campaign', value: LineItemKind.SMS_CAMPAIGN },
    { label: 'Surcharge', value: LineItemKind.SURCHARGE },
    { label: 'Discount', value: LineItemKind.DISCOUNT },
    { label: 'Custom', value: LineItemKind.CUSTOM },
  ];
  protected readonly discountModeOptions = [
    { label: 'Percent', value: 'PERCENT' as DiscountMode },
    { label: 'Fixed', value: 'AMOUNT' as DiscountMode },
  ];

  protected get isDiscountForm(): boolean {
    return this.formKind === LineItemKind.DISCOUNT;
  }

  protected get isParticipantForm(): boolean {
    return this.editingLine()?.kind === LineItemKind.PARTICIPANT;
  }

  openAdd(): void {
    this.editingLine.set(null);
    this.formKind = LineItemKind.EXTRA_USER;
    this.formDescription = '';
    this.formQuantity = 1;
    this.formUnitPrice = null;
    this.formDiscountMode = 'PERCENT';
    this.formPercent = null;
    this.formAmount = null;
    this.formOpen.set(true);
  }

  openEdit(line: LineItemResponse): void {
    this.editingLine.set(line);
    this.formKind = line.kind;
    this.formDescription = line.description;
    this.formQuantity = line.quantity ?? 1;
    this.formUnitPrice = line.unitPrice ?? null;
    if (line.kind === LineItemKind.DISCOUNT) {
      const isPercent = line.discountPercent != null;
      this.formDiscountMode = isPercent ? 'PERCENT' : 'AMOUNT';
      this.formPercent = line.discountPercent ?? null;
      this.formAmount = isPercent ? null : Math.abs(line.amount);
    }
    this.formOpen.set(true);
  }

  cancelForm(): void {
    this.formOpen.set(false);
    this.editingLine.set(null);
  }

  canSave(): boolean {
    if (this.saving()) return false;
    if (!this.formDescription.trim()) return false;
    if (this.isDiscountForm) {
      return this.formDiscountMode === 'PERCENT'
        ? this.formPercent != null && this.formPercent > 0 && this.formPercent <= 100
        : this.formAmount != null && this.formAmount > 0;
    }
    // Charge / participant line: a unit price is required; quantity defaults to 1.
    return (
      this.formUnitPrice != null &&
      this.formUnitPrice >= 0 &&
      (this.formQuantity == null || this.formQuantity >= 1)
    );
  }

  save(): void {
    const bill = this.bill();
    if (!bill || !this.canSave()) return;
    const editing = this.editingLine();
    this.saving.set(true);
    this.buildSaveRequest(bill.billId, editing)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.billChange.emit(updated);
          this.toast.success(editing ? 'Line item updated' : 'Line item added');
          this.cancelForm();
        },
        error: (error) => this.errorHandler.showError(error),
      });
  }

  /**
   * Pick the right endpoint for the current form:
   *  - editing the system PARTICIPANT line → its dedicated participant-line endpoint
   *    (unit price / quantity only; the line-items endpoint rejects it with 400);
   *  - editing a manual charge / discount → updateLineItem;
   *  - otherwise → addLineItem.
   */
  private buildSaveRequest(
    billId: string,
    editing: LineItemResponse | null,
  ): Observable<BillResponse> {
    const eventId = this.eventId();
    if (editing?.kind === LineItemKind.PARTICIPANT) {
      const body: ParticipantLineRequest = {
        unitPrice: this.formUnitPrice ?? undefined,
        quantity: this.formQuantity ?? undefined,
      };
      return this.billingService.updateParticipantLine(eventId, billId, body);
    }
    const body = this.buildBody();
    return editing
      ? this.billingService.updateLineItem(eventId, billId, editing.id, body)
      : this.billingService.addLineItem(eventId, billId, body);
  }

  private buildBody(): LineItemRequest {
    const kind = this.editingLine()?.kind ?? this.formKind;
    const description = this.formDescription.trim();
    if (kind === LineItemKind.DISCOUNT) {
      return this.formDiscountMode === 'PERCENT'
        ? { kind, description, percent: this.formPercent ?? undefined }
        : { kind, description, amount: this.formAmount ?? undefined };
    }
    return {
      kind,
      description,
      quantity: this.formQuantity ?? 1,
      unitPrice: this.formUnitPrice ?? undefined,
    };
  }

  removeLine(line: LineItemResponse, event: MouseEvent): void {
    const bill = this.bill();
    if (!bill) return;
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: `Remove "${line.description}" from this bill?`,
      icon: 'pi pi-trash',
      acceptButtonProps: { label: 'Remove', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.removingId.set(line.id);
        this.billingService
          .deleteLineItem(this.eventId(), bill.billId, line.id)
          .pipe(finalize(() => this.removingId.set(null)))
          .subscribe({
            next: (updated) => {
              this.billChange.emit(updated);
              this.toast.success('Line item removed');
            },
            error: (error) => this.errorHandler.showError(error),
          });
      },
    });
  }

  /** Payment is one-way: settle an UNPAID final as PAID (permanent, no revert). */
  markPaid(event: MouseEvent): void {
    const bill = this.bill();
    if (!bill || bill.paymentStatus === PaymentStatus.PAID) return;
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: 'Mark this bill as paid? This records the collection and cannot be undone.',
      icon: 'pi pi-wallet',
      acceptButtonProps: { label: 'Mark Paid' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.updatingPayment.set(true);
        this.billingService
          .updatePaymentStatus(bill.billId, PaymentStatus.PAID)
          .pipe(finalize(() => this.updatingPayment.set(false)))
          .subscribe({
            next: (updated) => {
              this.billChange.emit(updated);
              this.toast.success('Bill marked Paid. Stats will update shortly.');
            },
            error: (error) => this.errorHandler.showError(error),
          });
      },
    });
  }

  downloadBill(bill: BillResponse): void {
    // FINAL bills carry a short-lived presigned PDF URL (rendered server-side at finalize).
    if (bill.downloadUrl) window.open(bill.downloadUrl, '_blank', 'noopener');
  }

  onIssueFinal(event: MouseEvent): void {
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message:
        'Issue the final invoice? This freezes the bill and closes the event to further billing.',
      icon: 'pi pi-lock',
      acceptButtonProps: { label: 'Issue Final' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => this.issueFinal.emit(),
    });
  }
}
