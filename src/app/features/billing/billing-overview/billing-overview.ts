import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Plugin } from 'chart.js';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ChartModule } from 'primeng/chart';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs/operators';

import { BillingService } from '../../../core/services/billing.service';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { ToastService } from '../../../core/services/toast.service';
import { LayoutService } from '../../../core/services/layout.service';
import {
  BillCountKey,
  BillMoneyKey,
  BillResponse,
  BillStatsRange,
  BillStatsResponse,
  BillStatus,
  TrendedCount,
  TrendedMoney,
} from '../../../core/models/billing.model';
import { formatMoney } from '../../../shared/utils/currency.utils';
import {
  billReasonLabel,
  billReasonSeverity,
  billStatusLabel,
  billStatusSeverity,
  paymentStatusLabel,
  paymentStatusSeverity,
} from '../../../shared/utils/billing.utils';
import { FORM_INPUT_SIZE, BUTTON_SIZE } from '../../../shared/constants/form.constants';
import { OrgNamePipe } from '../../../shared/pipes/org-name-pipe';

interface ChartConfig {
  labels: string[];
  datasets: {
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    fill?: boolean;
    tension?: number;
    pointRadius?: number;
  }[];
}

interface LegendRow {
  label: string;
  color: string; // live `var(--p-…)` ref (theme-reactive in the DOM)
  primary: string;
  secondary: string;
}

/**
 * Platform Billing ▸ Overview — the auditor dashboard, served from the
 * Lambda-computed snapshot (`GET /api/billing/stats?range=…`): headline counts,
 * money totals with sparklines, a billed-vs-collected trend, type/status/payment
 * and receivables-aging breakdowns, top events / organizers, and a recent-bills
 * table (`GET /api/billing`). Charts paint to <canvas> so they're rebuilt on
 * theme change; DOM swatches bind `var(--p-…)` and re-colour for free.
 */
@Component({
  selector: 'app-billing-overview',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    CardModule,
    ButtonModule,
    SelectModule,
    ChartModule,
    TableModule,
    TagModule,
    TooltipModule,
    OrgNamePipe,
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

  protected readonly statusLabel = billStatusLabel;
  protected readonly statusSeverity = billStatusSeverity;
  protected readonly reasonLabel = billReasonLabel;
  protected readonly reasonSeverity = billReasonSeverity;
  protected readonly paymentLabel = paymentStatusLabel;
  protected readonly paymentSeverity = paymentStatusSeverity;
  protected readonly BillStatus = BillStatus;

  // Compact card padding so the grid reads as dense as the design.
  protected readonly cardPad = { body: { padding: '1rem' } };

  // ── Snapshot state ────────────────────────────────────────────────────────────
  private readonly data = signal<BillStatsResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly updating = signal(false);
  protected readonly range = signal<BillStatsRange>('ALL');
  protected readonly rangeOptions = [
    { label: 'All time', value: 'ALL' },
    { label: 'This year', value: 'YEAR' },
    { label: 'This month', value: 'MONTH' },
  ];

  protected readonly currency = computed(() => this.data()?.currency ?? 'INR');
  protected readonly comparisonLabel = computed(() => this.data()?.comparisonLabel ?? '');
  protected readonly refreshedAt = computed(() => this.data()?.refreshedAt ?? null);
  protected readonly hasSnapshot = computed(() => this.refreshedAt() !== null);
  protected readonly totalOutstanding = computed(() => this.data()?.outstanding.amount ?? 0);

  // ── Recent bills (separate paginated feed) ────────────────────────────────────
  protected readonly recentBills = signal<BillResponse[]>([]);
  protected readonly totalBills = signal(0);
  protected readonly billsLoading = signal(true);

  // ── Headline counters (counts) ────────────────────────────────────────────────
  private readonly kpiDefs: { key: BillCountKey; label: string; icon: string; color: string }[] = [
    { key: 'total', label: 'Total Bills', icon: 'pi pi-receipt', color: 'blue' },
    { key: 'draft', label: 'Draft Bills', icon: 'pi pi-file-edit', color: 'slate' },
    { key: 'final', label: 'Final Bills', icon: 'pi pi-check-circle', color: 'green' },
    { key: 'paid', label: 'Paid Bills', icon: 'pi pi-wallet', color: 'teal' },
    { key: 'unpaid', label: 'Unpaid Bills', icon: 'pi pi-exclamation-circle', color: 'red' },
  ];
  protected readonly kpiCards = computed(() => {
    const counts = this.data()?.counts;
    return this.kpiDefs.map((d) => {
      const c: TrendedCount = counts?.[d.key] ?? ZERO_COUNT;
      return { label: d.label, icon: d.icon, color: d.color, value: c.value, deltaPct: c.deltaPct };
    });
  });

  // ── Money cards (money) ───────────────────────────────────────────────────────
  private readonly moneyDefs: {
    key: BillMoneyKey;
    label: string;
    color: string;
    showCount: boolean;
  }[] = [
    { key: 'billed', label: 'Total Billed Amount', color: 'green', showCount: false },
    { key: 'collected', label: 'Collected Amount', color: 'green', showCount: false },
    { key: 'outstanding', label: 'Outstanding Amount', color: 'red', showCount: false },
    { key: 'averageBill', label: 'Average Bill Amount', color: 'green', showCount: false },
    { key: 'billedThisMonth', label: 'Billed This Month', color: 'blue', showCount: true },
  ];
  protected readonly amountCards = computed(() => {
    const money = this.data()?.money;
    return this.moneyDefs.map((d) => {
      const m: TrendedMoney = money?.[d.key] ?? ZERO_TMONEY;
      return {
        label: d.label,
        color: d.color,
        amount: m.amount,
        deltaPct: d.showCount ? null : m.deltaPct,
        sub: d.showCount ? `${(m.count ?? 0).toLocaleString('en-IN')} Bills` : null,
      };
    });
  });

  // ── Donut legends (percent + count/amount; computed from the snapshot) ────────
  protected readonly typeLegend = computed<LegendRow[]>(() => {
    const r = this.data()?.byReason;
    const auto = r?.AUTO?.count ?? 0;
    const manual = r?.MANUAL?.count ?? 0;
    const total = auto + manual;
    return [
      {
        label: 'Auto',
        color: this.ref('blue'),
        primary: this.pct(auto, total),
        secondary: count(auto),
      },
      {
        label: 'Manual',
        color: this.ref('slate'),
        primary: this.pct(manual, total),
        secondary: count(manual),
      },
    ];
  });
  protected readonly statusLegend = computed<LegendRow[]>(() => {
    const s = this.data()?.byStatus;
    const draft = s?.DRAFT ?? 0;
    const final = s?.FINAL ?? 0;
    const total = draft + final;
    return [
      {
        label: 'Draft',
        color: this.ref('amber'),
        primary: this.pct(draft, total),
        secondary: count(draft),
      },
      {
        label: 'Final',
        color: this.ref('blue'),
        primary: this.pct(final, total),
        secondary: count(final),
      },
    ];
  });
  protected readonly paymentLegend = computed<LegendRow[]>(() => {
    const p = this.data()?.payment;
    const paid = p?.paid ?? 0;
    const unpaid = p?.unpaid ?? 0;
    const total = paid + unpaid;
    return [
      {
        label: 'Paid',
        color: this.ref('green'),
        primary: this.pct(paid, total),
        secondary: `(${this.formatInr(paid)})`,
      },
      {
        label: 'Unpaid',
        color: this.ref('red'),
        primary: this.pct(unpaid, total),
        secondary: `(${this.formatInr(unpaid)})`,
      },
    ];
  });
  protected readonly agingLegend = computed<LegendRow[]>(() => {
    const aging = this.data()?.aging ?? [];
    const total = aging.reduce((s, b) => s + b.amount, 0);
    return aging.map((b, i) => ({
      label: AGING_LABELS[b.bucket] ?? b.bucket,
      color: this.ref(AGING_COLORS[i] ?? 'slate'),
      primary: this.formatInr(b.amount),
      secondary: `(${this.pct(b.amount, total)})`,
    }));
  });

  // ── Canvas chart state (rebuilt on theme × data change) ───────────────────────
  protected readonly sparklines = signal<(ChartConfig | null)[]>([]);
  protected readonly trendChart = signal<ChartConfig | null>(null);
  protected readonly typeChart = signal<ChartConfig | null>(null);
  protected readonly statusChart = signal<ChartConfig | null>(null);
  protected readonly paymentChart = signal<ChartConfig | null>(null);
  protected readonly agingChart = signal<ChartConfig | null>(null);
  protected readonly topEventsChart = signal<ChartConfig | null>(null);
  protected readonly outstandingChart = signal<ChartConfig | null>(null);

  // ── Chart options ─────────────────────────────────────────────────────────────
  protected readonly sparkOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
  };

  protected readonly doughnutOptions = {
    cutout: '68%',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  };

  protected readonly trendOptions = computed(() => {
    this.trackTheme();
    const text = this.cssVar('--p-text-muted-color');
    const border = this.cssVar('--p-content-border-color');
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: { color: text, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
              `${ctx.dataset.label}: ${this.formatMoney(ctx.parsed.y, this.currency())}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: text } },
        y: {
          beginAtZero: true,
          grid: { color: border },
          ticks: { color: text, callback: (v: string | number) => this.formatLakh(Number(v)) },
        },
      },
    };
  });

  protected readonly barOptions = computed(() => {
    this.trackTheme();
    const text = this.cssVar('--p-text-muted-color');
    const border = this.cssVar('--p-content-border-color');
    return {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 72 } }, // room for the value drawn at each bar end
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: border },
          ticks: { color: text, callback: (v: string | number) => this.formatLakh(Number(v)) },
        },
        y: { grid: { display: false }, ticks: { color: text } },
      },
    };
  });

  // Inline plugin: draws the full rupee value just past the end of each bar.
  protected readonly barValueLabels: Plugin<'bar'> = {
    id: 'barValueLabels',
    afterDatasetsDraw: (chart) => {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data as number[];
      ctx.save();
      ctx.font = '600 11px Inter, ui-sans-serif, sans-serif';
      ctx.fillStyle = this.cssVar('--p-text-color') || '#334155';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      meta.data.forEach((el, i) => {
        const point = el as unknown as { x: number; y: number };
        ctx.fillText(this.formatInr(data[i]), point.x + 8, point.y);
      });
      ctx.restore();
    },
  };

  // Stable reference so PrimeNG Chart doesn't re-init on every change-detection pass.
  protected readonly barPlugins = [this.barValueLabels];

  constructor() {
    // Canvas can't read CSS custom properties live, so rebuild every chart when
    // the active theme (dark mode / preset / primary / surface) or data changes.
    effect(() => {
      this.trackTheme();
      this.data();
      this.rebuildCharts();
    });
  }

  ngOnInit(): void {
    this.load();
    // The recent-bills table loads its first page via the lazy table's onLazyLoad.
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
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

  /** Re-trigger the snapshot recompute; the new figures land async, so re-fetch shortly after. */
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

  // ── Recent bills ──────────────────────────────────────────────────────────────
  onRecentLazy(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? 5;
    const page = Math.floor((event.first ?? 0) / rows);
    this.loadRecentBills(page, rows);
  }

  private loadRecentBills(page = 0, size = 5): void {
    this.billsLoading.set(true);
    this.billingService
      .searchBills({ page, size, sort: ['createdAt,desc'] })
      .pipe(finalize(() => this.billsLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.recentBills.set(res.content ?? []);
          this.totalBills.set(res.totalElements ?? 0);
        },
        error: (error) => {
          this.recentBills.set([]);
          this.totalBills.set(0);
          this.errorHandler.showError(error);
        },
      });
  }

  billNo(bill: BillResponse): string {
    return bill.invoiceNumber ?? `#${bill.billId.slice(0, 8)}`;
  }

  goToAllBills(): void {
    this.router.navigate(['/billing', 'all-bills']);
  }

  goToEventBilling(bill: BillResponse): void {
    this.router.navigate(['/events', bill.eventId, 'billing']);
  }

  // ── Chart builders ────────────────────────────────────────────────────────────
  private rebuildCharts(): void {
    this.rebuildSparklines();
    this.rebuildTrend();
    this.rebuildDonuts();
    this.rebuildBars();
  }

  private rebuildSparklines(): void {
    const money = this.data()?.money;
    this.sparklines.set(
      this.moneyDefs.map((d) => {
        const series = money?.[d.key]?.spark ?? [];
        if (!series.length) return null;
        const stroke = this.resolve(d.color);
        return {
          labels: series.map((_, i) => `${i}`),
          datasets: [
            {
              data: series,
              borderColor: stroke,
              backgroundColor: this.alpha(stroke, 0.14),
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            },
          ],
        };
      }),
    );
  }

  private rebuildTrend(): void {
    const t = this.data()?.trend;
    if (!t?.bucketLabels?.length) {
      this.trendChart.set(null);
      return;
    }
    const billed = this.resolve('green');
    const collected = this.resolve('blue');
    this.trendChart.set({
      labels: t.bucketLabels,
      datasets: [
        {
          label: 'Billed Amount',
          data: t.billed ?? [],
          borderColor: billed,
          backgroundColor: this.alpha(billed, 0.12),
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
        {
          label: 'Collected Amount',
          data: t.collected ?? [],
          borderColor: collected,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    });
  }

  private rebuildDonuts(): void {
    const d = this.data();
    const type = d?.byReason;
    this.typeChart.set(
      this.donut(
        ['Auto', 'Manual'],
        [type?.AUTO?.count ?? 0, type?.MANUAL?.count ?? 0],
        ['blue', 'slate'],
      ),
    );
    const status = d?.byStatus;
    this.statusChart.set(
      this.donut(['Draft', 'Final'], [status?.DRAFT ?? 0, status?.FINAL ?? 0], ['amber', 'blue']),
    );
    const pay = d?.payment;
    this.paymentChart.set(
      this.donut(['Paid', 'Unpaid'], [pay?.paid ?? 0, pay?.unpaid ?? 0], ['green', 'red']),
    );
    const aging = d?.aging ?? [];
    this.agingChart.set(
      this.donut(
        aging.map((b) => AGING_LABELS[b.bucket] ?? b.bucket),
        aging.map((b) => b.amount),
        aging.map((_, i) => AGING_COLORS[i] ?? 'slate'),
      ),
    );
  }

  private rebuildBars(): void {
    const events = this.data()?.topEvents ?? [];
    this.topEventsChart.set({
      labels: events.map((e) => e.eventName),
      datasets: [
        {
          data: events.map((e) => e.billed),
          backgroundColor: this.resolve('blue'),
          borderRadius: 6,
        },
      ],
    });
    // "Outstanding by organizer" — reuse the org leaderboard, sorted by outstanding.
    const orgs = [...(this.data()?.topOrganizations ?? [])]
      .sort((a, b) => b.outstanding - a.outstanding)
      .filter((o) => o.outstanding > 0);
    this.outstandingChart.set({
      labels: orgs.map((o) => o.organizerName),
      datasets: [
        {
          data: orgs.map((o) => o.outstanding),
          backgroundColor: this.resolve('red'),
          borderRadius: 6,
        },
      ],
    });
  }

  private donut(labels: string[], data: number[], colors: string[]): ChartConfig {
    return {
      labels,
      datasets: [{ data, backgroundColor: colors.map((c) => this.resolve(c)), borderWidth: 0 }],
    };
  }

  // ── Number formatting ─────────────────────────────────────────────────────────
  /** Full Indian-grouped rupee value, no decimals (e.g. ₹12,45,600). */
  protected formatInr(value: number): string {
    return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  }

  /** Indian-grouped amount with 2 decimals, no symbol (e.g. 1,24,500.00). */
  protected amountPlain(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Compact axis label in lakhs/crores (e.g. ₹5L, ₹1.5Cr). */
  protected formatLakh(value: number): string {
    if (value >= 10000000) {
      const cr = value / 10000000;
      return '₹' + (Number.isInteger(cr) ? cr : cr.toFixed(1)) + 'Cr';
    }
    if (value >= 100000) {
      const l = value / 100000;
      return '₹' + (Number.isInteger(l) ? l : l.toFixed(1)) + 'L';
    }
    if (value >= 1000) return '₹' + Math.round(value / 1000) + 'K';
    return '₹' + value;
  }

  /** "78%" / "74.6%" share of a total. */
  private pct(value: number, total: number): string {
    const p = total ? (value / total) * 100 : 0;
    return (Number.isInteger(p) ? p : p.toFixed(1)) + '%';
  }

  // ── Theme palette helpers ─────────────────────────────────────────────────────
  /** Concrete colour for canvas (resolved theme token, hex fallback). */
  private resolve(name: string): string {
    return this.cssVar(`--p-${name}-500`) || PALETTE[name] || name;
  }

  /** Live `var(--p-…)` ref for DOM swatches/icons (re-colours with the theme). */
  protected ref(name: string): string {
    return `var(--p-${name}-500, ${PALETTE[name] ?? name})`;
  }

  /** Soft tinted background for an icon chip — a translucent mix of the colour. */
  protected tint(name: string): string {
    return `color-mix(in srgb, ${this.ref(name)} 14%, transparent)`;
  }

  /** Translucent fill for a canvas area (rgba derived from the resolved hex). */
  private alpha(color: string, a: number): string {
    const hex = color.startsWith('#') ? color : '';
    if (hex.length === 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
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
const ZERO_COUNT: TrendedCount = { value: 0, deltaPct: null };
const ZERO_TMONEY: TrendedMoney = { amount: 0, deltaPct: null, spark: [] };

const AGING_LABELS: Record<string, string> = {
  '0-30': '0 - 30 Days',
  '31-60': '31 - 60 Days',
  '61-90': '61 - 90 Days',
  '90+': '90+ Days',
};
// Index-aligned with the aging buckets (oldest → newest receivable).
const AGING_COLORS = ['teal', 'amber', 'orange', 'red'];

/** Parenthesised Indian-grouped count, e.g. "(1,020)". */
function count(n: number): string {
  return `(${n.toLocaleString('en-IN')})`;
}

// Chart/legend palette keys → hex fallbacks. These keep canvas charts and DOM
// swatches coloured even before a `--p-{color}-500` theme token resolves. Kept at
// module scope so the legend computeds (which call `ref()`) can read it.
const PALETTE: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  teal: '#14b8a6',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  slate: '#64748b',
  cyan: '#06b6d4',
};
