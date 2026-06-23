import { EventStatus } from './event.model';

export type DashboardRange = 'ALL' | 'YEAR' | 'MONTH';
export type TrendInterval = 'DAY' | 'WEEK' | 'MONTH';

export interface OrgInfoDto {
  id: number;
  organizerName: string;
  email?: string;
  phoneNumber?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  createdAt?: string;
  enabled: boolean;
  /** Short-lived presigned URL for the organization logo; null/undefined if none set. */
  logoUrl?: string;
}

export interface CityCountDto {
  city: string;
  count: number;
}

export interface EventListItemDto {
  id: number;
  eventName: string;
  eventStartDate: string;
  eventStartTime?: string;
  timezone?: string;
  city?: string;
  status: EventStatus;
  logoUrl?: string;
}

export interface EventsDashboardDto {
  total: number;
  upcoming: number;
  byStatus: Record<string, number>;
  byCity: CityCountDto[];
  distinctCities: number;
  active: EventListItemDto[];
  recent: EventListItemDto[];
}

export interface UserCountsDto {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
}

export interface TrendSeriesDto {
  events: number[];
  active: number[];
  users: number[];
  cities: number[];
}

export interface TrendsDto {
  interval: TrendInterval;
  buckets: number;
  bucketLabels: string[];
  series: TrendSeriesDto;
}

export interface OrgDashboardResponse {
  refreshedAt: string;
  range: DashboardRange;
  organization: OrgInfoDto;
  events: EventsDashboardDto;
  users: UserCountsDto;
  trends: TrendsDto;
}

export interface OrgDashboardParams {
  range?: DashboardRange;
  statusRange?: DashboardRange;
  citiesRange?: DashboardRange;
  trendBuckets?: number;
  trendInterval?: TrendInterval;
  topCities?: number;
}

// ── Platform dashboard (ROOT / ADMIN) ──

/** Lightweight org entry for the Recent Organizations list. */
export interface OrgListItemDto {
  id: number;
  organizerName: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  city?: string;
  stateProvince?: string;
  createdAt: string;
}

/** Org entry for the Top Organizations table, ranked by activity. */
export interface TopOrgDto {
  id: number;
  organizerName: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  eventCount: number;
  userCount: number;
  createdAt: string;
}

/** Upcoming event entry, including its owning organization. */
export interface UpcomingEventDto {
  id: number;
  eventName: string;
  eventStartDate: string;
  eventStartTime?: string;
  timezone?: string;
  city?: string;
  status: EventStatus;
  organizationId: number;
  organizerName: string;
}

export interface PlatformOrganizationsDto {
  total: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  recent: OrgListItemDto[];
  top: TopOrgDto[];
}

export interface PlatformEventsDto {
  total: number;
  active: number;
  byStatus: Record<string, number>;
  byCity: CityCountDto[];
  distinctCities: number;
  upcomingList: UpcomingEventDto[];
}

export interface PlatformUsersDto {
  total: number;
  byRole: Record<string, number>;
}

export interface PlatformTrendSeriesDto {
  organizations: number[];
  events: number[];
  users: number[];
  activeEvents: number[];
  cities: number[];
}

export interface PlatformTrendsDto {
  interval: TrendInterval;
  buckets: number;
  bucketLabels: string[];
  series: PlatformTrendSeriesDto;
}

export interface PlatformDashboardResponse {
  refreshedAt: string;
  range: DashboardRange;
  organizations: PlatformOrganizationsDto;
  events: PlatformEventsDto;
  users: PlatformUsersDto;
  trends: PlatformTrendsDto;
}

export interface PlatformDashboardParams {
  range?: DashboardRange;
  tierRange?: DashboardRange;
  statusRange?: DashboardRange;
  citiesRange?: DashboardRange;
  trendBuckets?: number;
  trendInterval?: TrendInterval;
  topCities?: number;
  topOrgs?: number;
}

export interface PlatformRevenueTrendDto {
  interval: TrendInterval;
  bucketLabels: string[];
  earned: number[];
}

export interface PlatformRevenueResponse {
  refreshedAt: string | null;
  currency: string;
  range: DashboardRange;
  earned: number;
  deltaPct: number | null;
  comparisonLabel: string | null;
  trend: PlatformRevenueTrendDto;
}

export interface PlatformRevenueParams {
  range?: DashboardRange;
  trendBuckets?: number;
  trendInterval?: TrendInterval;
}
