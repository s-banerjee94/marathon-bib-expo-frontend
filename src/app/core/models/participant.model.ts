export interface Participant {
  eventId: string;
  bibNumber: string;
  chipNumber: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string; // M, F, O
  country?: string;
  city?: string;
  raceId: string;
  raceName: string;
  categoryId: string;
  categoryName: string;
  goodies?: { [key: string]: string };
  bibCollectedAt?: string;
  bibCollectedByName?: string;
  bibCollectedByPhone?: string;
  bibDistributedBy?: string;
  goodiesDistribution?: { [key: string]: string };
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ParticipantListResponse {
  participants: Participant[];
  lastEvaluatedKey?: string;
  count: number;
  hasMore: boolean;
}

export interface ParticipantFilterPreferences {
  organizationId?: number;
  eventId?: number;
  raceId?: string;
  categoryId?: string;
  gender?: string;
  [key: string]: unknown;
}

export interface ParticipantSearchParams {
  eventId: number;
  searchTerm?: string;
  raceId?: string;
  categoryId?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  city?: string;
  country?: string;
  limit: number;
  lastEvaluatedKey?: string;
}

export type LookupSearchType = 'NAME' | 'EMAIL' | 'PHONE' | 'BIB' | 'RACE' | 'CATEGORY';

export interface ParticipantLookupParams {
  eventId: number;
  searchType: LookupSearchType;
  searchValue: string;
  limit: number;
  lastEvaluatedKey?: string;
}

export interface ImportParticipantsResponse {
  importId: string;
  status: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  message: string;
}

export interface ParticipantStatisticsResponse {
  eventId: number;
  totalParticipants: number;
  bibCollectedCount: number;
  pendingCount: number;
  raceBreakdown: RaceStatistics[];
  categoryBreakdown: CategoryStatistics[];
  genderBreakdown: GenderStatistics;
  status?: string;
}

export interface RaceStatistics {
  raceId: string;
  raceName: string;
  count: number;
  bibCollectedCount: number;
}

export interface CategoryStatistics {
  categoryId: string;
  categoryName: string;
  count: number;
}

export interface GenderStatistics {
  male: number;
  female: number;
  other: number;
}

export interface CreateParticipantRequest {
  chipNumber: string;
  bibNumber: string;
  fullName: string;
  raceId: number;
  raceName: string;
  categoryId: number;
  categoryName: string;
  gender: string; // M, F, O
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
  age?: number;
  country?: string;
  city?: string;
  bibCollectedAt?: string;
  goodies?: { [key: string]: string };
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}

export interface UpdateParticipantRequest {
  chipNumber?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  country?: string;
  city?: string;
  raceId?: string;
  categoryId?: string;
  newBibNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  bibCollectedAt?: string;
}

export type ImportErrorType =
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_BIB'
  | 'REFERENCE_ERROR'
  | 'BATCH_WRITE_ERROR'
  | 'PROCESSING_ERROR';

export interface ImportErrorItem {
  rowNumber: number;
  errorType: ImportErrorType;
  field?: string;
  message: string;
}

export interface ErrorSummary {
  validationErrors: number;
  duplicateBibErrors: number;
  referenceErrors: number;
  batchWriteErrors: number;
  processingErrors: number;
}

export interface ImportErrorListResponse {
  importId: string;
  errors: ImportErrorItem[];
  count: number;
  lastEvaluatedKey?: string;
  hasMore: boolean;
}

export interface ImportJobResponse {
  importId: string;
  eventId: number;
  eventName?: string;
  fileName?: string;
  status: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  errorSummary?: ErrorSummary;
  importedBy?: number;
  importedAt: string;
}

export interface ImportJobListResponse {
  imports: ImportJobResponse[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export interface BatchImportResponse {
  jobExecutionId: number;
  status: string;
  deletedCount?: number;
}

export interface BatchJobStatusResponse {
  jobExecutionId: number;
  status: string; // STARTING | STARTED | COMPLETED | FAILED | STOPPED | ABANDONED | UNKNOWN
  readCount: number;
  writeCount: number;
  skipCount: number;
  startTime: string;
  endTime?: string;
}

export interface DeleteParticipantsResponse {
  eventId: number;
  eventName?: string;
  deletedCount: number;
  failedCount: number;
  message: string;
}
