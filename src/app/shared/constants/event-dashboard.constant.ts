import { EventDashboardRange } from '../../core/models/event-dashboard.model';

export interface EventDashboardRangeOption {
  label: string;
  value: EventDashboardRange;
}

/**
 * The range toggle scopes only the distribution-activity blocks. A bib expo runs
 * at most a few days, so there is no "all time" window — just Today / Full Expo.
 */
export const EVENT_DASHBOARD_RANGE_OPTIONS: EventDashboardRangeOption[] = [
  { label: 'Today', value: 'TODAY' },
  { label: 'Full Expo', value: 'FULL_EXPO' },
];

/** Rows shown in the Recent Collections feed. */
export const RECENT_COLLECTIONS_LIMIT = 8;

/** Silent poll cadence (ms) for the live activity rollup + recent feed. */
export const DASHBOARD_POLL_INTERVAL_MS = 30_000;

// ── Chart colour keys (PrimeNG primitive tokens → resolved via chart-palette.util) ──
// Gender doughnut: male / female / other.
export const GENDER_CHART_COLORS = ['blue', 'pink', 'slate'];

// Race-distribution doughnut: each race takes its own colour, cycling when there
// are more races than colours.
export const RACE_DISTRIBUTION_COLORS = [
  'blue',
  'violet',
  'cyan',
  'teal',
  'orange',
  'green',
  'amber',
  'pink',
  'indigo',
  'rose',
];

// Gauge "collected" arc + the collection-over-time line accent.
export const COLLECTED_ACCENT = 'green';

export const GENDER_CHART_LABELS = ['Male', 'Female', 'Other'];

// ── Reference-stable chart option literals (theme-agnostic; colours live in data) ──
// A single shared literal means PrimeNG Chart never sees a new `options` ref and
// won't re-paint on every change-detection cycle.
export const DASHBOARD_DOUGHNUT_OPTIONS = {
  cutout: '62%',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
};
