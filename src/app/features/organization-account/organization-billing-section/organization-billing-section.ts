import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { finalize } from 'rxjs/operators';

import { BaseTableComponent } from '../../../shared/base/base-table.component';
import { TableFilterPreferences } from '../../../shared/models/table-config.model';
import { ListShell } from '../../../shared/components/list/list-shell/list-shell';
import {
  BillReason,
  BillResponse,
  BillStatus,
  PaymentStatus,
} from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { formatMoney } from '../../../shared/utils/currency.utils';
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
  ORG_BILL_COLUMNS,
  DEFAULT_ORG_BILL_COLUMN_FIELDS,
} from '../../../shared/constants/bill-columns.constant';
import { BILL_SORT_OPTIONS } from '../../../shared/constants/sort-options.constant';
import { STORAGE_KEYS } from '../../../shared/constants/storage-keys.constant';
import { DefaultValuePipe } from '../../../shared/pipes/default-value.pipe';
import { BillDetailDialog } from '../../billing/bill-detail-dialog/bill-detail-dialog';
import { OrganizationAccountState } from '../organization-account-state.service';
import { EmptyIllustration } from '../../../shared/illustrations/empty-illustration';

interface OrgBillFilterPreferences extends TableFilterPreferences {
  enabled: boolean;
  sort: string[];
  reason: BillReason | null;
  paymentStatus: PaymentStatus | null;
}

/**
 * Accounts ▸ Billing — one organization's own bills, presented with the same
 * dynamic-column table as the platform All Bills tab (BaseTableComponent +
 * ListShell). It's **read-only** (organizers can View a bill but only ROOT/ADMIN
 * settle payments) and **client-side**: `GET /api/organizations/{id}/billing`
 * returns the full list in one shot, so search / sort / filter / pagination all
 * run over the cached array.
 */
@Component({
  selector: 'app-organization-billing-section',
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    TagModule,
    SelectModule,
    DatePickerModule,
    FloatLabelModule,
    SkeletonModule,
    TooltipModule,
    DefaultValuePipe,
    ListShell,
    BillDetailDialog,
    EmptyIllustration,
  ],
  providers: [DialogService],
  templateUrl: './organization-billing-section.html',
  styleUrl: './organization-billing-section.css',
})
export class OrganizationBillingSection extends BaseTableComponent<
  BillResponse,
  OrgBillFilterPreferences
> {
  protected override columnPreferenceKey = STORAGE_KEYS.ORG_BILL_TABLE_COLUMNS;
  protected override filterPreferenceKey = STORAGE_KEYS.ORG_BILL_TABLE_FILTERS;
  protected override allColumns = ORG_BILL_COLUMNS;

  private billingService = inject(BillingService);
  private state = inject(OrganizationAccountState);

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

  // The full org bill list, fetched once; the table renders client-side slices.
  private readonly allBills = signal<BillResponse[]>([]);
  // Set while fetching a bill's line items for the View dialog, if a row lacks them.
  protected readonly viewLoadingId = signal<string | null>(null);

  // Filters (client-side). No Organization filter — this is a single org.
  protected readonly reason = signal<BillReason | null>(null);
  protected readonly paymentStatus = signal<PaymentStatus | null>(null);
  protected readonly dateRange = signal<Date[] | null>(null);
  protected readonly reasonOptions = [
    { label: 'Automatic', value: BillReason.AUTO },
    { label: 'Manual', value: BillReason.MANUAL },
  ];
  protected readonly paymentOptions = [
    { label: 'Paid', value: PaymentStatus.PAID },
    { label: 'Unpaid', value: PaymentStatus.UNPAID },
  ];
  protected readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.reason()) count++;
    if (this.paymentStatus()) count++;
    if (this.dateRange()?.length) count++;
    return count;
  });

  // Read-only bill detail (organizers view line items; only ROOT/ADMIN edit).
  protected readonly selectedBill = signal<BillResponse | null>(null);
  protected readonly detailVisible = signal(false);

  constructor() {
    super();
    this.pageSize.set(10);
    this.initializeColumns();
    if (!this.storage.getJSON(STORAGE_KEYS.ORG_BILL_TABLE_COLUMNS)) {
      this.selectedCols.set(
        this.allColumns.filter((c) => DEFAULT_ORG_BILL_COLUMN_FIELDS.includes(c.field)),
      );
    }
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.fetch();
  }

  private fetch(): void {
    const orgId = this.state.organization()?.id;
    if (orgId == null) return;
    this.isLoading.set(true);
    this.billingService
      .getOrganizationBilling(orgId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.allBills.set(data.bills ?? []);
          this.applyAndRender();
        },
        error: (error) => {
          this.allBills.set([]);
          this.applyAndRender();
          this.errorHandler.showError(error);
        },
      });
  }

  // The org endpoint is not paginated, so every list change re-derives client-side.
  protected override loadData(): void {
    this.applyAndRender();
  }

  private applyAndRender(): void {
    let rows = [...this.allBills()];

    const term = this.searchTerm().trim().toLowerCase();
    if (term.length >= 2) {
      rows = rows.filter(
        (b) =>
          b.eventName?.toLowerCase().includes(term) ||
          b.invoiceNumber?.toLowerCase().includes(term),
      );
    }
    if (this.reason()) rows = rows.filter((b) => b.reason === this.reason());
    if (this.paymentStatus()) {
      rows = rows.filter(
        (b) => b.status === BillStatus.FINAL && b.paymentStatus === this.paymentStatus(),
      );
    }
    const range = this.dateRange();
    if (range?.[0] && range?.[1]) {
      const from = this.startOfDay(range[0]);
      const to = this.endOfDay(range[1]);
      rows = rows.filter((b) => {
        const t = new Date(b.createdAt).getTime();
        return t >= from && t <= to;
      });
    }

    rows = this.sortRows(rows);

    this.totalRecords.set(rows.length);
    const start = this.currentPage() * this.pageSize();
    this.entities.set(rows.slice(start, start + this.pageSize()));
  }

  private sortRows(rows: BillResponse[]): BillResponse[] {
    const [field, dir] = (this.filterSort()[0] ?? 'createdAt,desc').split(',');
    const factor = dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => factor * this.compareBills(a, b, field));
  }

  private compareBills(a: BillResponse, b: BillResponse, field: string): number {
    switch (field) {
      case 'totalAmount':
        return (a.totalAmount ?? 0) - (b.totalAmount ?? 0);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'paymentStatus':
        return (a.paymentStatus ?? '').localeCompare(b.paymentStatus ?? '');
      default:
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  }

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
    this.dateRange.set(null);
    this.onFilterChange();
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

  downloadBill(bill: BillResponse): void {
    // FINAL bills carry a short-lived presigned PDF URL; only open a real link.
    if (bill.downloadUrl) window.open(bill.downloadUrl, '_blank', 'noopener');
  }

  protected override getDefaultFilterPreferences(): OrgBillFilterPreferences {
    return { enabled: true, sort: ['createdAt,desc'], reason: null, paymentStatus: null };
  }

  protected override getCurrentFilterPreferences(): OrgBillFilterPreferences {
    return {
      enabled: this.filterEnabled(),
      sort: this.filterSort(),
      reason: this.reason(),
      paymentStatus: this.paymentStatus(),
    };
  }

  protected override applyFilterPreferences(prefs: OrgBillFilterPreferences): void {
    this.filterEnabled.set(prefs.enabled ?? true);
    this.filterSort.set(prefs.sort?.length ? prefs.sort : ['createdAt,desc']);
    this.reason.set(prefs.reason ?? null);
    this.paymentStatus.set(prefs.paymentStatus ?? null);
  }

  private startOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private endOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
}
