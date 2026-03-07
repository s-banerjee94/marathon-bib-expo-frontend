export interface AppNotification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  eventId: number;
  jobExecutionId: number;
  createdAt: string;
}

export interface NotificationPageResponse {
  content: AppNotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasContent: boolean;
  empty: boolean;
  numberOfElements: number;
}
