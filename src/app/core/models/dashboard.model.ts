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
