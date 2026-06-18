/**
 * Event-details Dashboard tab rollup — matches the backend
 * `GET /api/events/{eventId}/dashboard?range=` contract (group 12-dashboard).
 *
 * Everything here is either event-wide (constant) or range-scoped (changes with
 * `range`). Recent Collections is NOT part of this rollup — the dashboard reads
 * it from the existing `GET /events/{eventId}/distribution/logs` feed.
 */

export type EventDashboardRange = 'TODAY' | 'FULL_EXPO';

export interface EventContext {
  eventId: number;
  timezone: string;
  /** Expo start in the event's time zone, e.g. "2026-06-14T09:00:00+05:30". */
  expoStart: string;
  expoEnd: string;
  dayCount: number;
  /** 1-based expo day "now" falls on; null when outside the expo window. */
  currentDayIndex: number | null;
}

export interface ParticipantTotals {
  total: number;
  collected: number;
  pending: number;
  collectedPercent: number;
}

export interface GenderBreakdown {
  male: number;
  female: number;
  other: number;
}

export interface RaceStat {
  raceId: string;
  raceName: string;
  total: number;
  collected: number;
  collectedPercent: number;
}

/** Per-category total, tagged with its race for client-side filtering. */
export interface CategoryStat {
  raceId: string;
  categoryId: string;
  categoryName: string;
  total: number;
}

export interface DashboardRate {
  value: number;
  /** Always PER_HOUR. */
  unit: string;
}

/** Busiest hour bucket in the window. */
export interface DashboardPeak {
  /** Start of the peak hour, in the event's time zone. */
  bucketStart: string;
  count: number;
  dayIndex: number;
}

export interface TimelinePoint {
  /** Start of the hour, in the event's time zone. */
  bucketStart: string;
  dayIndex: number;
  count: number;
}

export interface TimelineSeries {
  /** 'primary' (the window) or 'compare' (the prior day, TODAY only). */
  key: string;
  label: string;
  /** Empty when there is no prior day to compare. */
  points: TimelinePoint[];
}

export interface DashboardTimeline {
  /** Always HOUR. */
  interval: string;
  series: TimelineSeries[];
}

export interface DistributorCount {
  distributorId: string;
  name: string;
  count: number;
}

/** Range-scoped bib-collection activity. */
export interface EventActivity {
  range: EventDashboardRange;
  collected: number;
  collectedPercentOfTotal: number;
  rate: DashboardRate;
  peak?: DashboardPeak | null;
  timeline: DashboardTimeline;
  distributors: DistributorCount[];
}

export interface EventDashboardResponse {
  /** When this rollup was computed, in the event's time zone. */
  refreshedAt: string;
  range: EventDashboardRange;
  event: EventContext;
  participants: ParticipantTotals;
  gender: GenderBreakdown;
  races: RaceStat[];
  categories: CategoryStat[];
  activity: EventActivity;
}
