import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { finalize } from 'rxjs/operators';
import { EventStatus } from '../../../../core/models/event.model';
import {
  BillGenerateMode,
  BillGenerationResponse,
  BillGenerationStatus,
  BillResponse,
  BillStatus,
} from '../../../../core/models/billing.model';
import { BillingService } from '../../../../core/services/billing.service';
import { ErrorHandlerService } from '../../../../core/services/error-handler.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/user.model';
import { EventDetailsState } from '../event-details-state.service';
import { BUTTON_SIZE, FORM_INPUT_SIZE } from '../../../../shared/constants/form.constants';
import { injectIsMobile } from '../../../../shared/utils/responsive.utils';
import { billStatusLabel } from '../../../../shared/utils/billing.utils';
import { BillDetail } from '../../../billing/bill-detail/bill-detail';
import { EmptyIllustration } from '../../../../shared/illustrations/empty-illustration';

@Component({
  selector: 'app-event-billing-section',
  imports: [
    FormsModule,
    ButtonModule,
    SkeletonModule,
    SelectButtonModule,
    TooltipModule,
    ConfirmPopupModule,
    BillDetail,
    EmptyIllustration,
  ],
  providers: [ConfirmationService],
  templateUrl: './event-billing-section.html',
  styleUrl: './event-billing-section.css',
})
export class EventBillingSection implements OnInit {
  eventId = input.required<number, string>({ transform: (v) => Number(v) });

  private billingService = inject(BillingService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private confirmationService = inject(ConfirmationService);
  private authService = inject(AuthService);
  private state = inject(EventDetailsState);

  protected readonly bills = signal<BillResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly generating = signal(false);
  protected readonly buttonSize = BUTTON_SIZE;
  protected readonly inputSize = FORM_INPUT_SIZE;
  protected readonly isMobile = injectIsMobile();
  protected readonly statusLabel = billStatusLabel;

  // Only ROOT/ADMIN may manually generate, edit lines, issue finals, or change payment.
  protected readonly canManage = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);

  // Which bill the inline detail shows. An event usually has a single bill; when a
  // draft and a final coexist, a switcher lets the user pick (otherwise it's hidden).
  protected readonly selectedBillId = signal<string | null>(null);
  protected readonly selectedBill = computed<BillResponse | null>(() => {
    const list = this.bills();
    return list.find((b) => b.billId === this.selectedBillId()) ?? list[0] ?? null;
  });
  protected readonly billOptions = computed(() =>
    this.bills().map((b) => ({
      label: b.invoiceNumber
        ? `${this.statusLabel(b.status)} · ${b.invoiceNumber}`
        : this.statusLabel(b.status),
      value: b.billId,
    })),
  );

  // A bill can only be generated once the event is terminal (COMPLETED or CANCELLED).
  protected readonly isBillable = computed(() => {
    const status = this.state.event()?.status;
    return status === EventStatus.COMPLETED || status === EventStatus.CANCELLED;
  });

  protected readonly generateTooltip = computed(() =>
    this.isBillable()
      ? ''
      : 'A bill can be generated only after the event is completed or cancelled.',
  );

  ngOnInit(): void {
    this.loadBills();
  }

  loadBills(): void {
    this.isLoading.set(true);
    this.billingService
      .listBills(this.eventId())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (bills) => {
          this.bills.set(bills);
          this.syncSelection();
        },
        error: (error) => this.errorHandler.showError(error),
      });
  }

  onGenerate(event: MouseEvent): void {
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message:
        'Generate a draft bill for this event now? This cancels the pending automatic bill (the scheduled 24-hour auto-draft), if one is still waiting.',
      icon: 'pi pi-receipt',
      acceptButtonProps: { label: 'Generate' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => this.runGenerate('DRAFT'),
    });
  }

  /** The inline detail asked to issue the final invoice for the selected draft. */
  onIssueFinal(): void {
    this.runGenerate('FINAL');
  }

  private runGenerate(mode: BillGenerateMode): void {
    this.generating.set(true);
    this.billingService
      .generateBill(this.eventId(), mode)
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: (response) => {
          // The response already carries the refreshed list — patch in place, no refetch.
          this.bills.set(response.bills);
          this.notifyGeneration(response);
          // After issuing a final, jump the detail to it.
          if (mode === 'FINAL') {
            const final = response.bills.find((b) => b.status === BillStatus.FINAL);
            if (final) this.selectedBillId.set(final.billId);
          }
          this.syncSelection();
        },
        error: (error) => this.errorHandler.showError(error),
      });
  }

  /** A mutation inside the inline detail returned the refreshed bill — patch in place. */
  onBillChange(updated: BillResponse): void {
    this.bills.update((list) => list.map((b) => (b.billId === updated.billId ? updated : b)));
    this.selectedBillId.set(updated.billId);
  }

  // Keep the selected bill valid as the list changes; default to the newest.
  private syncSelection(): void {
    const list = this.bills();
    if (!list.some((b) => b.billId === this.selectedBillId())) {
      this.selectedBillId.set(list[0]?.billId ?? null);
    }
  }

  private notifyGeneration(response: BillGenerationResponse): void {
    switch (response.status) {
      case BillGenerationStatus.CREATED_DRAFT:
        this.toast.success(response.message, 'Draft bill generated');
        break;
      case BillGenerationStatus.CREATED_FINAL:
        this.toast.success(response.message, 'Final invoice issued');
        break;
      case BillGenerationStatus.SKIPPED_DUPLICATE:
        this.toast.info(response.message, 'Existing bill returned');
        break;
      case BillGenerationStatus.SKIPPED_NOT_BILLABLE:
        this.toast.warn(response.message, 'Not billable');
        break;
      case BillGenerationStatus.ALREADY_FINAL:
        this.toast.info(response.message, 'Already finalized');
        break;
    }
  }
}
