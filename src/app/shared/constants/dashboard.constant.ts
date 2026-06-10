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

// Shared chart-palette colour keys colouring the status / role doughnuts and
// their legends (index-aligned with the label arrays above). Status colours are
// semantically aligned with the event-status tag severities: Draft=warn/amber,
// Published=success/green, Completed=info/blue, Cancelled=danger/red.
export const EVENT_STATUS_COLORS = ['amber', 'green', 'blue', 'red'];

export const USER_ROLE_COLORS = ['violet', 'blue', 'teal'];

// Per-stat-card accent colour keys, keyed by spark key. Drives both the card's
// icon chip and its sparkline so each card reads as its own colour.
export const ORG_STAT_CARD_COLORS: Record<string, string> = {
  events: 'blue',
  active: 'green',
  users: 'violet',
  cities: 'orange',
};

// Per-quick-action accent colour keys (index-aligned with the quick-action order).
export const ORG_QUICK_ACTION_COLORS = ['blue', 'violet', 'teal', 'green', 'orange', 'cyan'];

// Colour cycle for the Events-by-City bars so each city reads as its own colour.
// All entries are PrimeNG primitive colour keys (→ `--p-{name}-500`). Cycles
// when there are more cities than colours.
export const EVENTS_BY_CITY_COLORS = [
  'blue',
  'teal',
  'violet',
  'orange',
  'green',
  'cyan',
  'amber',
  'pink',
  'indigo',
  'rose',
];
