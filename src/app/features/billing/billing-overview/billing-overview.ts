import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { finalize } from 'rxjs/operators';
import { BillingService } from '../../../core/services/billing.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { LayoutService } from '../../../core/services/layout.service';
import {
  BillStatsComputedBy,
  BillStatsRange,
  BillStatsResponse,
} from '../../../core/models/billing.model';
import { formatMoney } from '../../../shared/utils/currency.utils';
import { FORM_INPUT_SIZE, BUTTON_SIZE } from '../../../shared/constants/form.constants';

interface LineChartConfig {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    tension: number;
    pointRadius: number;
  }[];
}

/**
 * Platform Billing ▸ Overview — auditor-grade billing statistics read from the
 * Lambda-computed snapshot (`GET /api/billing/stats`). Billed → collected →
 * outstanding with GST split, collection rate, DSO, receivables aging, a
 * billed-vs-collected 12-month trend, and a top-organizations leaderboard. The
 * snapshot can be re-triggered (async) via Refresh. Only FINAL bills count.
 */
@Component({
  selector: 'app-billing-overview',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    CardModule,
    SkeletonModule,
    SelectModule,
    ButtonModule,
    ChartModule,
    ProgressBarModule,
  ],
  templateUrl: './billing-overview.html',
  styleUrl: './billing-overview.css',
})
export class BillingOverview implements OnInit {
  private billingService = inject(BillingService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private layout = inject(LayoutService);
  private router = inject(Router);

  protected readonly inputSize = FORM_INPUT_SIZE;
  protected readonly buttonSize = BUTTON_SIZE;
  protected readonly formatMoney = formatMoney;

  private readonly data = signal<BillStatsResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly updating = signal(false);
  protected readonly range = signal<BillStatsRange>('ALL');
  protected readonly rangeOptions = [
    { label: 'All time', value: 'ALL' },
    { label: 'This year', value: 'YEAR' },
    { label: 'This month', value: 'MONTH' },
  ];

  // ── Freshness ───────────────────────────────────────────────────────────────
  protected readonly refreshedAt = computed(() => this.data()?.refreshedAt ?? null);
  /** The snapshot exists once it has been computed at least once. */
  protected readonly hasSnapshot = computed(() => this.refreshedAt() !== null);
  protected readonly computedByLabel = computed(() => {
    const by = this.data()?.computedBy;
    return by ? COMPUTED_BY_LABELS[by] : '';
  });

  // ── Empty-safe derived values ─────────────────────────────────────────────────
  protected readonly currency = computed(() => this.data()?.currency ?? 'INR');
  protected readonly billed = computed(() => this.data()?.billed ?? ZERO_BILLED);
  protected readonly collected = computed(() => this.data()?.collected ?? ZERO_MONEY);
  protected readonly outstanding = computed(() => this.data()?.outstanding ?? ZERO_MONEY);
  protected readonly collectionRate = computed(() => this.data()?.collectionRate ?? 0);
  protected readonly averageBill = computed(() => this.data()?.averageBill ?? 0);
  protected readonly dso = computed(() => this.data()?.dso ?? 0);
  protected readonly gst = computed(() => this.data()?.gst ?? ZERO_GST);

  protected readonly reasonRows = computed(() => {
    const by = this.data()?.byReason;
    const auto = by?.AUTO ?? ZERO_MONEY;
    const manual = by?.MANUAL ?? ZERO_MONEY;
    const total = auto.amount + manual.amount;
    return [
      { label: 'Automatic', ...auto, percent: total ? (auto.amount / total) * 100 : 0 },
      { label: 'Manual', ...manual, percent: total ? (manual.amount / total) * 100 : 0 },
    ];
  });

  protected readonly agingRows = computed(() => {
    const aging = this.data()?.aging ?? [];
    const max = aging.reduce((m, b) => Math.max(m, b.amount), 0);
    return aging.map((b) => ({ ...b, percent: max ? (b.amount / max) * 100 : 0 }));
  });

  protected readonly topOrgs = computed(() => {
    const orgs = this.data()?.topOrganizations ?? [];
    const max = orgs.reduce((m, o) => Math.max(m, o.billed), 0);
    return orgs.map((o) => ({ ...o, percent: max ? (o.billed / max) * 100 : 0 }));
  });

  // ── Trend chart (theme-reactive canvas; billed vs collected) ──────────────────
  protected readonly trendChart = signal<LineChartConfig | null>(null);
  protected readonly hasTrend = computed(() => {
    const t = this.data()?.trend;
    return !!t?.bucketLabels?.length && (t.billed?.some((v) => v > 0) ?? false);
  });

  protected readonly trendOptions = computed(() => {
    this.trackTheme();
    const text = this.cssVar('--p-text-muted-color');
    const border = this.cssVar('--p-content-border-color');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: text } },
        tooltip: { enabled: true },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: text } },
        y: { beginAtZero: true, ticks: { color: text }, grid: { color: border } },
      },
    };
  });

  constructor() {
    // Canvas can't consume CSS custom properties live, so rebuild on theme change.
    effect(() => {
      this.trackTheme();
      this.data();
      this.rebuildTrend();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.billingService
      .getBillStats(this.range())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (d) => this.data.set(d),
        error: (error) => this.errorHandler.showError(error),
      });
  }

  onRangeChange(value: BillStatsRange): void {
    if (value === this.range()) return;
    this.range.set(value);
    this.load();
  }

  /**
   * Re-trigger the snapshot recompute. The new figures land asynchronously, so we
   * show an "updating" state and re-fetch shortly after to pick them up.
   */
  refresh(): void {
    if (this.updating()) return;
    this.updating.set(true);
    this.billingService.refreshBillStats().subscribe({
      next: () => {
        this.toast.info('Stats refresh triggered — updating shortly.');
        setTimeout(() => {
          this.load();
          this.updating.set(false);
        }, 1500);
      },
      error: (error) => {
        this.updating.set(false);
        this.errorHandler.showError(error);
      },
    });
  }

  goToOrg(organizationId: number): void {
    this.router.navigate(['/organizations', organizationId, 'edit']);
  }

  private rebuildTrend(): void {
    const t = this.data()?.trend;
    if (!t?.bucketLabels?.length) {
      this.trendChart.set(null);
      return;
    }
    this.trendChart.set({
      labels: t.bucketLabels,
      datasets: [
        {
          label: 'Billed',
          data: t.billed ?? [],
          borderColor: this.cssVar('--p-primary-500') || '#6366f1',
          backgroundColor: this.cssVar('--p-primary-100') || '#e0e7ff',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
        {
          label: 'Collected',
          data: t.collected ?? [],
          borderColor: this.cssVar('--p-primary-700') || '#4338ca',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    });
  }

  private trackTheme(): void {
    this.layout.isDarkTheme();
    this.layout.selectedPrimary();
    this.layout.selectedSurface();
    this.layout.selectedPreset();
  }

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
}

// Empty-state fallbacks so a never-computed snapshot renders 0s, not undefined.
const ZERO_MONEY = { amount: 0, count: 0 };
const ZERO_BILLED = { amount: 0, net: 0, tax: 0, count: 0 };
const ZERO_GST = { collected: 0, outstanding: 0, total: 0 };

const COMPUTED_BY_LABELS: Record<BillStatsComputedBy, string> = {
  FINALIZE: 'a finalized invoice',
  PAYMENT: 'a payment update',
  MANUAL: 'a manual refresh',
};
