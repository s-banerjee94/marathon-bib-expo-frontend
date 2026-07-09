export type NotificationType =
  | 'IMPORT_COMPLETED'
  | 'IMPORT_FAILED'
  | 'SHORT_URLS_COMPLETED'
  | 'EVENT_CREATED'
  | 'EVENT_PUBLISHED'
  | 'EVENT_CANCELLED'
  | 'EVENT_COMPLETED'
  | 'CAMPAIGN_COMPLETED'
  | 'CAMPAIGN_FAILED';

export type NotificationEntityType = 'EVENT' | 'CAMPAIGN';

export interface AppNotification {
  // Opaque base64 token — store and pass back verbatim; never parse, sort, or build URLs from it.
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  // Deep-link target; both null when the notification is not routable.
  entityType: NotificationEntityType | null;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  count: number;
  // Opaque cursor for the next page; null when there are no more pages.
  lastEvaluatedKey: string | null;
  hasMore: boolean;
}
