export type StatisticsScope = 'GLOBAL' | 'ORGANIZATION';

export interface UserStatsData {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
}

export interface UserStatisticsResponse {
  scope: StatisticsScope;
  organizationId?: number;
  organizationName?: string;
  refreshedAt: string;
  users: UserStatsData;
}

export interface OrganizationStatsData {
  total: number;
  active: number;
  inactive: number;
  bySubscriptionTier: Record<string, number>;
  bySubscriptionStatus: Record<string, number>;
}

export interface OrganizationStatisticsResponse {
  scope: StatisticsScope;
  refreshedAt: string;
  organizations: OrganizationStatsData;
}

export interface EventStatsData {
  total: number;
  upcoming: number;
  byStatus: Record<string, number>;
}

export interface EventStatisticsResponse {
  scope: StatisticsScope;
  organizationId?: number;
  organizationName?: string;
  refreshedAt: string;
  events: EventStatsData;
}
