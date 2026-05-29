import { DashboardRange } from '../../core/models/dashboard.model';

export interface DashboardTimeRangeOption {
  label: string;
  value: DashboardRange;
}

// Number of audit-log rows to show in the dashboard's Recent Activity card.
export const RECENT_ACTIVITY_LIMIT = 4;

// Time-range dropdown options shared by the per-card range selectors.
export const DASHBOARD_TIME_RANGE_OPTIONS: DashboardTimeRangeOption[] = [
  { label: 'All Time', value: 'ALL' },
  { label: 'This Year', value: 'YEAR' },
  { label: 'This Month', value: 'MONTH' },
];

// Doughnut chart options. Theme-agnostic and reference-stable: a single shared
// literal means PrimeNG Chart never sees a new `options` reference and won't
// re-paint on change-detection cycles.
export const DASHBOARD_DOUGHNUT_OPTIONS = {
  cutout: '72%',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
};

// Sparkline (line) chart options. Also theme-agnostic and reference-stable.
export const DASHBOARD_SPARKLINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: { x: { display: false }, y: { display: false } },
  elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
};

// Category labels for the Events-by-Status doughnut + legend (order matters —
// it lines up with EVENT_STATUS_PALETTE_TOKENS and the value arrays).
export const EVENT_STATUS_CHART_LABELS = ['Draft', 'Published', 'Completed', 'Cancelled'];

// Category labels for the User-Role doughnut + legend.
export const USER_ROLE_CHART_LABELS = ['Organization Admin', 'Organization Users', 'Distributors'];

// Theme CSS-variable tokens colouring the status / role doughnuts (index-aligned
// with the label arrays above).
export const EVENT_STATUS_PALETTE_TOKENS = [
  '--p-primary-500',
  '--p-primary-300',
  '--p-primary-200',
  '--p-surface-300',
];

export const USER_ROLE_PALETTE_TOKENS = ['--p-primary-500', '--p-primary-300', '--p-surface-300'];
