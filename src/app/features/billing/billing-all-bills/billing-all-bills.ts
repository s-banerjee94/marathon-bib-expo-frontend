import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { finalize } from 'rxjs/operators';

import { BaseTableComponent } from '../../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../../shared/models/table-config.model';
import { ListShell } from '../../../shared/components/list/list-shell/list-shell';
import { BillingService } from '../../../core/services/billing.service';
import {
  BillGenerationResponse,
  BillGenerationStatus,
  BillReason,
  BillResponse,
  BillSearchParams,
  BillStatus,
  PaymentStatus,
} from '../../../core/models/billing.model';
import { UserRole } from '../../../core/models/user.model';
import { formatMoney } from '../../../shared/utils/currency.utils';
import { hueVar, OrgHue, randomHue } from '../../../shared/utils/org-palette.util';
import {
  billColumnAlignment,
  billReasonLabel,
  billReasonSeverity,
  billStatusLabel,
  billStatusSeverity,
  paymentStatusLabel,
  paymentStatusSeverity,
} from '../../../shared/utils/billing.utils';
import {
  BILL_COLUMNS,
  DEFAULT_BILL_COLUMN_FIELDS,
} from '../../../shared/constants/bill-columns.constant';
import { BILL_SORT_OPTIONS } from '../../../shared/constants/sort-options.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { OrgNamePipe } from '../../../shared/pipes/org-name-pipe';
import { EventLogoPipe } from '../../../shared/pipes/event-logo-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';
import { OrganizationSelector } from '../../../layout/organization-selector/organization-selector';
import { BillDetailDialog } from '../bill-detail-dialog/bill-detail-dialog';

interface BillFilterPreferences extends TableFilterPreferences {
  enabled: boolean;
  sort: string[];
  reason: BillReason | null;
  paymentStatus: PaymentStatus | null;
  organizationId: number | null;
}

/**
 * Platform "All Bills" — the global, paginated bill feed (ROOT/ADMIN). Built on
 * BaseTableComponent + ListShell so it gets server-side pagination, debounced
 * search, sort, persisted column selection (the dynamic column picker), and the
 * desktop-table / mobile-card split for free. The feed returns bill headers only
 * (no line items), so columns map to header fields.
 */
@Component({
  selector: 'app-billing-all-bills',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    AvatarModule,
    TagModule,
    SelectModule,
    DatePickerModule,
    FloatLabelModule,
    SkeletonModule,
    TooltipModule,
    ConfirmPopupModule,
    RouterLink,
    DefaultValuePipe,
    OrgNamePipe,
    EventLogoPipe,
    InitialsPipe,
    OrganizationSelector,
    ListShell,
    BillDetailDialog,
  ],
  providers: [ConfirmationService, DialogService],
  templateUrl: './billing-all-bills.html',
  styleUrl: './billing-all-bills.css',
})
export class BillingAllBills extends BaseTableComponent<BillResponse, BillFilterPreferences> {
  protected override columnPreferenceKey = STORAGE_KEYS.BILL_TABLE_COLUMNS;
  protected override filterPreferenceKey = STORAGE_KEYS.BILL_TABLE_FILTERS;
  protected override allColumns = BILL_COLUMNS;

  private billingService = inject(BillingService);
  private confirmationService = inject(ConfirmationService);

  protected readonly formatMoney = formatMoney;
  protected readonly statusLabel = billStatusLabel;
  protected readonly statusSeverity = billStatusSeverity;
  protected readonly paymentLabel = paymentStatusLabel;
  protected readonly paymentSeverity = paymentStatusSeverity;
  protected readonly reasonLabel = billReasonLabel;
  protected readonly reasonSeverity = billReasonSeverity;
  protected readonly getColumnAlignment = billColumnAlignment;
  protected readonly BillStatus = BillStatus;
  protected readonly PaymentStatus = PaymentStatus;
  protected readonly sortOptions = BILL_SORT_OPTIONS;

  // PT: shrink the avatar initials to 60% (−40%) of the large size; logo images are unaffected.
  protected readonly avatarPt = { label: { style: { fontSize: '60%' } } };

  protected readonly updatingPaymentId = signal<string | null>(null);

  // Bill detail dialog. The feed omits line items, so View fetches the full bill.
  // This console is ROOT/ADMIN-only, so they can edit a draft's line items (and
  // issue the final) right here; BillDetail keeps finals frozen via `editable`.
  protected readonly canManage = this.authService.hasAnyRole([UserRole.ROOT, UserRole.ADMIN]);
  protected readonly selectedBill = signal<BillResponse | null>(null);
  protected readonly detailVisible = signal(false);
  protected readonly viewLoadingId = signal<string | null>(null);
  protected readonly selectedEventId = computed(() => Number(this.selectedBill()?.eventId ?? 0));

  // Filters — search + sort come from the base; these are billing-specific.
  protected readonly reason = signal<BillReason | null>(null);
  protected readonly paymentStatus = signal<PaymentStatus | null>(null);
  protected readonly organizationId = signal<number | null>(null);
  protected readonly dateRange = signal<Date[] | null>(null);
  protected readonly reasonOptions = [
    { label: 'Automatic', value: BillReason.AUTO },
    { label: 'Manual', value: BillReason.MANUAL },
  ];
  protected readonly paymentOptions = [
    { label: 'Paid', value: PaymentStatus.PAID },
    { label: 'Unpaid', value: PaymentStatus.UNPAID },
  ];

  // Filter-drawer badge (search/sort excluded — search has its own indicator).
  protected readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.reason()) count++;
    if (this.paymentStatus()) count++;
    if (this.organizationId()) count++;
    if (this.dateRange()?.length) count++;
    return count;
  });

  // The desktop lazy table emits onLazyLoad once on first render; we load in
  // ngOnInit instead (so it also runs on mobile, where the table isn't rendered)
  // and skip that first table emission to avoid a duplicate request.
  private initialLazySkipped = false;

  constructor() {
    super();
    this.pageSize.set(25);
    this.initializeColumns();
    // No saved preference yet → start from the curated default column set.
    if (!this.storage.getJSON(STORAGE_KEYS.BILL_TABLE_COLUMNS)) {
      this.selectedCols.set(
        this.allColumns.filter((c) => DEFAULT_BILL_COLUMN_FIELDS.includes(c.field)),
      );
    }
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadData();
  }

  override onPageChange(event: TableLazyLoadEvent): void {
    if (!this.isMobile() && !this.initialLazySkipped) {
      this.initialLazySkipped = true;
      return;
    }
    super.onPageChange(event);
  }

  protected override loadData(): void {
    this.isLoading.set(true);
    const term = this.searchTerm().trim();
    const range = this.dateRange();
    const sort = this.filterSort();
    const params: BillSearchParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: sort.length ? sort : ['createdAt,desc'],
      reason: this.reason() ?? undefined,
      paymentStatus: this.paymentStatus() ?? undefined,
      organizationId: this.organizationId() ?? undefined,
      q: term.length >= 2 ? term : undefined,
      from: range?.[0] ? this.toIso(range[0], false) : undefined,
      to: range?.[1] ? this.toIso(range[1], true) : undefined,
    };
    this.billingService
      .searchBills(params)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.entities.set(res.content ?? []);
          this.totalRecords.set(res.totalElements ?? 0);
        },
        error: (error) => {
          this.entities.set([]);
          this.totalRecords.set(0);
          this.errorHandler.showError(error);
        },
      });
  }

  // Range mode fills the array progressively; only reload once both ends exist.
  onDateSelect(): void {
    const range = this.dateRange();
    if (range?.[0] && range?.[1]) this.onFilterChange();
  }

  onDateClear(): void {
    this.dateRange.set(null);
    this.onFilterChange();
  }

  clearFilters(): void {
    this.reason.set(null);
    this.paymentStatus.set(null);
    this.organizationId.set(null);
    this.dateRange.set(null);
    this.onFilterChange();
  }

  downloadBill(bill: BillResponse): void {
    // FINAL bills carry a short-lived presigned PDF URL; only open a real link.
    if (bill.downloadUrl) window.open(bill.downloadUrl, '_blank', 'noopener');
  }

  // A random PrimeNG hue per bill, cached by billId so the card accent and avatar
  // share one colour and it stays fixed across re-renders.
  private readonly billHues = new Map<string, OrgHue>();

  private hueFor(bill: BillResponse): OrgHue {
    let hue = this.billHues.get(bill.billId);
    if (!hue) {
      hue = randomHue();
      this.billHues.set(bill.billId, hue);
    }
    return hue;
  }

  /** Left-edge accent on the mobile card — a truly random PrimeNG palette colour, fixed per bill. */
  cardAccent(bill: BillResponse): Record<string, string> {
    return { 'border-left': `4px solid ${hueVar(this.hueFor(bill), 500)}` };
  }

  /** Avatar fill + initials colour — the same random hue as the card accent. */
  avatarStyle(bill: BillResponse): Record<string, string> {
    const hue = this.hueFor(bill);
    return { 'background-color': hueVar(hue, 100), color: hueVar(hue, 700) };
  }

  /** Payment is one-way: settle an UNPAID final as PAID (permanent, no revert). */
  markPaid(bill: BillResponse, event: MouseEvent): void {
    if (bill.paymentStatus === PaymentStatus.PAID) return;
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: 'Mark this bill as paid? This records the collection and cannot be undone.',
      icon: 'pi pi-wallet',
      acceptButtonProps: { label: 'Mark Paid' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => {
        this.updatingPaymentId.set(bill.billId);
        this.billingService
          .updatePaymentStatus(bill.billId, PaymentStatus.PAID)
          .pipe(finalize(() => this.updatingPaymentId.set(null)))
          .subscribe({
            next: (updated) => {
              // Patch the row in place — no refetch.
              this.entities.update((list) =>
                list.map((b) => (b.billId === updated.billId ? updated : b)),
              );
              this.toast.success('Bill marked Paid. Stats will update shortly.');
            },
            error: (error) => this.errorHandler.showError(error),
          });
      },
    });
  }

  openDetail(bill: BillResponse): void {
    // The feed returns the full BillResponse including line items (per the contract);
    // open directly when present. Only fall back to fetching the full bill (via the
    // per-event list, which always carries line items) if a row arrives without them.
    if (bill.lineItems?.length) {
      this.selectedBill.set(bill);
      this.detailVisible.set(true);
      return;
    }
    this.viewLoadingId.set(bill.billId);
    this.billingService
      .listBills(Number(bill.eventId))
      .pipe(finalize(() => this.viewLoadingId.set(null)))
      .subscribe({
        next: (bills) => {
          this.selectedBill.set(bills.find((b) => b.billId === bill.billId) ?? bill);
          this.detailVisible.set(true);
        },
        error: (error) => this.errorHandler.showError(error),
      });
  }

  /** A line-item / payment mutation in the dialog returned the refreshed bill — patch in place. */
  onBillChange(updated: BillResponse): void {
    this.entities.update((list) => list.map((b) => (b.billId === updated.billId ? updated : b)));
    this.selectedBill.set(updated);
  }

  /** The dialog asked to issue the final invoice for the open draft. */
  onIssueFinal(): void {
    const bill = this.selectedBill();
    if (!bill) return;
    this.billingService.generateBill(Number(bill.eventId), 'FINAL').subscribe({
      next: (response) => {
        this.notifyGeneration(response);
        const final = response.bills.find((b) => b.status === BillStatus.FINAL);
        if (final) this.selectedBill.set(final);
        // The global feed row changed (draft → final) — refresh the current page.
        this.loadData();
      },
      error: (error) => this.errorHandler.showError(error),
    });
  }

  private notifyGeneration(response: BillGenerationResponse): void {
    switch (response.status) {
      case BillGenerationStatus.CREATED_FINAL:
        this.toast.success(response.message, 'Final invoice issued');
        break;
      case BillGenerationStatus.ALREADY_FINAL:
        this.toast.info(response.message, 'Already finalized');
        break;
      case BillGenerationStatus.SKIPPED_NOT_BILLABLE:
        this.toast.warn(response.message, 'Not billable');
        break;
      default:
        this.toast.info(response.message);
    }
  }

  protected override getDefaultFilterPreferences(): BillFilterPreferences {
    return {
      enabled: true,
      sort: ['createdAt,desc'],
      reason: null,
      paymentStatus: null,
      organizationId: null,
    };
  }

  protected override getCurrentFilterPreferences(): BillFilterPreferences {
    return {
      enabled: this.filterEnabled(),
      sort: this.filterSort(),
      reason: this.reason(),
      paymentStatus: this.paymentStatus(),
      organizationId: this.organizationId(),
    };
  }

  protected override applyFilterPreferences(prefs: BillFilterPreferences): void {
    this.filterEnabled.set(prefs.enabled ?? true);
    this.filterSort.set(prefs.sort?.length ? prefs.sort : ['createdAt,desc']);
    this.reason.set(prefs.reason ?? null);
    this.paymentStatus.set(prefs.paymentStatus ?? null);
    this.organizationId.set(prefs.organizationId ?? null);
  }

  private toIso(date: Date, endOfDay: boolean): string {
    const d = new Date(date);
    if (endOfDay) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
}
