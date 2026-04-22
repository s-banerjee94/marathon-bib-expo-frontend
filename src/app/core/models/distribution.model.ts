export interface CollectBibRequest {
  collectorName?: string;
  collectorPhone?: string;
  goodiesItems?: string[];
}

export interface BibDistributionResponse {
  success: boolean;
  bibNumber: string;
  collectedAt: string;
  collectedByName?: string;
  collectedByPhone?: string;
  distributedByUserId?: number;
  distributedByUsername?: string;
  goodiesDistributed?: string[];
}

export interface DistributeGoodiesRequest {
  goodiesItems: string[];
}

export interface GoodiesDistributionResponse {
  success: boolean;
  bibNumber: string;
  itemsDistributed: string[];
  distributedAt: string;
  distributedByUserId?: number;
  distributedByUsername?: string;
}

export interface BulkCollectBibRequest {
  bibNumbers: string[];
  collectorName?: string;
  collectorPhone?: string;
}

export interface BulkDistributeGoodiesRequest {
  items: DistributionItem[];
}

export interface DistributionItem {
  bibNumber: string;
  goodiesItems: string[];
}

export interface BulkDistributionResponse {
  successCount: number;
  successful: string[];
  failed: FailedOperation[];
}

export interface FailedOperation {
  bibNumber: string;
  itemName?: string;
  reason: string;
}

export interface UndoDistributionResponse {
  success: boolean;
  message: string;
  bibNumber: string;
  undoneAt: string;
  undoneByUserId?: number;
  undoneByUsername?: string;
}

export interface ParticipantDistributionResponse {
  eventId: string;
  bibNumber: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  raceName: string;
  categoryName: string;
  bibCollectedAt?: string;
  bibCollectedByName?: string;
  bibCollectedByPhone?: string;
  bibDistributedBy?: string;
  goodies?: { [key: string]: string };
  goodiesDistribution?: { [key: string]: string };
}

export interface ParticipantPendingGoodies {
  eventId: string;
  bibNumber: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  raceName: string;
  categoryName: string;
  bibCollectedAt?: string;
  goodies?: { [key: string]: string };
  goodiesDistribution?: { [key: string]: string };
  pendingItems: string[];
}

export interface PendingGoodiesListResponse {
  participants: ParticipantPendingGoodies[];
  lastEvaluatedKey?: string;
  count: number;
  hasMore: boolean;
}

export interface PendingBibListResponse {
  participants: ParticipantDistributionResponse[];
  lastEvaluatedKey?: string;
  count: number;
  hasMore: boolean;
}

export type DistributionAction =
  | 'BIB_COLLECTED'
  | 'BIB_UNDONE'
  | 'GOODIES_DISTRIBUTED'
  | 'GOODIES_UNDONE';

export type LogSearchType = 'BIB' | 'ACTION' | 'PERFORMED_BY' | 'COLLECTOR' | 'COLLECTOR_PHONE';

export interface DistributionLogResponse {
  eventId: string;
  timestamp: string;
  bibNumber: string;
  action: DistributionAction;
  itemNames?: string[];
  performedBy?: string;
  collectorName?: string;
  collectorPhone?: string;
  details?: string;
}

export interface DistributionLogListResponse {
  logs: DistributionLogResponse[];
  lastEvaluatedKey?: string;
  count: number;
  hasMore: boolean;
}
