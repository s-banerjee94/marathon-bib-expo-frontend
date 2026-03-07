import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BatchImportResponse,
  BatchJobStatusResponse,
  CreateParticipantRequest,
  DeleteParticipantsResponse,
  ImportErrorListResponse,
  ImportJobListResponse,
  ImportParticipantsResponse,
  Participant,
  ParticipantListResponse,
  ParticipantLookupParams,
  ParticipantSearchParams,
  ParticipantStatisticsResponse,
  UpdateParticipantRequest,
} from '../models/participant.model';
import { BASE_URI } from '../../shared/constants/api.constant';

@Injectable({
  providedIn: 'root',
})
export class ParticipantService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/events`;

  /**
   * Search participants using DynamoDB scan with filters
   * Uses /api/events/{eventId}/participants/search endpoint
   */
  searchParticipants(params: ParticipantSearchParams): Observable<ParticipantListResponse> {
    let httpParams = new HttpParams().set('limit', params.limit.toString());

    if (params.searchTerm) {
      httpParams = httpParams.set('searchTerm', params.searchTerm);
    }

    if (params.raceId) {
      httpParams = httpParams.set('raceId', params.raceId);
    }

    if (params.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }

    if (params.gender) {
      httpParams = httpParams.set('gender', params.gender);
    }

    if (params.minAge !== undefined) {
      httpParams = httpParams.set('minAge', params.minAge.toString());
    }

    if (params.maxAge !== undefined) {
      httpParams = httpParams.set('maxAge', params.maxAge.toString());
    }

    if (params.city) {
      httpParams = httpParams.set('city', params.city);
    }

    if (params.country) {
      httpParams = httpParams.set('country', params.country);
    }

    if (params.lastEvaluatedKey) {
      httpParams = httpParams.set('lastEvaluatedKey', params.lastEvaluatedKey);
    }

    return this.http.get<ParticipantListResponse>(
      `${this.apiUrl}/${params.eventId}/participants/search`,
      { params: httpParams },
    );
  }

  /**
   * Lookup participants using DynamoDB LSI (Local Secondary Indexes)
   * RECOMMENDED: More efficient than search - uses Query instead of Scan
   * Uses /api/events/{eventId}/participants/lookup endpoint
   */
  lookupParticipants(params: ParticipantLookupParams): Observable<ParticipantListResponse> {
    let httpParams = new HttpParams()
      .set('searchType', params.searchType)
      .set('searchValue', params.searchValue)
      .set('limit', params.limit.toString());

    if (params.lastEvaluatedKey) {
      httpParams = httpParams.set('lastEvaluatedKey', params.lastEvaluatedKey);
    }

    return this.http.get<ParticipantListResponse>(
      `${this.apiUrl}/${params.eventId}/participants/lookup`,
      { params: httpParams },
    );
  }

  /**
   * Get all participants for an event (no search/filter)
   * Uses /api/events/{eventId}/participants endpoint
   */
  getParticipants(
    eventId: number,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<ParticipantListResponse> {
    let httpParams = new HttpParams().set('limit', limit.toString());

    if (lastEvaluatedKey) {
      httpParams = httpParams.set('lastEvaluatedKey', lastEvaluatedKey);
    }

    return this.http.get<ParticipantListResponse>(`${this.apiUrl}/${eventId}/participants`, {
      params: httpParams,
    });
  }

  getParticipantByBibNumber(eventId: number, bibNumber: string): Observable<Participant> {
    return this.http.get<Participant>(`${this.apiUrl}/${eventId}/participants/${bibNumber}`);
  }

  createParticipant(
    eventId: number,
    participant: CreateParticipantRequest,
  ): Observable<Participant> {
    return this.http.post<Participant>(`${this.apiUrl}/${eventId}/participants`, participant);
  }

  updateParticipant(
    eventId: number,
    bibNumber: string,
    participant: UpdateParticipantRequest,
  ): Observable<Participant> {
    return this.http.patch<Participant>(
      `${this.apiUrl}/${eventId}/participants/${bibNumber}`,
      participant,
    );
  }

  deleteParticipant(eventId: number, bibNumber: string): Observable<DeleteParticipantsResponse> {
    return this.http.delete<DeleteParticipantsResponse>(
      `${this.apiUrl}/${eventId}/participants/${bibNumber}`,
    );
  }

  /**
   * Delete ALL participants for an event
   * ⚠️ WARNING: Permanently deletes all participants. Cannot be undone.
   */
  deleteAllParticipants(eventId: number): Observable<DeleteParticipantsResponse> {
    return this.http.delete<DeleteParticipantsResponse>(`${this.apiUrl}/${eventId}/participants`);
  }

  /**
   * Import participants from CSV file (FULL REPLACE) — DEPRECATED
   * WARNING: Synchronous, deletes all existing participants before importing.
   * Use launchBatchImport instead.
   * @deprecated Use launchBatchImport
   */
  importParticipants(eventId: number, file: File): Observable<ImportParticipantsResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ImportParticipantsResponse>(
      `${this.apiUrl}/${eventId}/participants/import`,
      formData,
    );
  }

  /**
   * Launch async CSV import via Spring Batch (returns 202 immediately)
   * Use getBatchImportStatus to poll progress
   */
  launchBatchImport(eventId: number, file: File): Observable<BatchImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BatchImportResponse>(
      `${this.apiUrl}/${eventId}/participants/batch-import`,
      formData,
    );
  }

  /**
   * Poll Spring Batch job status
   * Status values: STARTING, STARTED, COMPLETED, FAILED, STOPPED, ABANDONED, UNKNOWN
   */
  getBatchImportStatus(
    eventId: number,
    jobExecutionId: number,
  ): Observable<BatchJobStatusResponse> {
    return this.http.get<BatchJobStatusResponse>(
      `${this.apiUrl}/${eventId}/participants/batch-import/${jobExecutionId}/status`,
    );
  }

  /**
   * Get errors from the latest batch import for an event
   * Uses /api/events/{eventId}/participants/batch-import/latest/errors endpoint
   */
  getLatestBatchImportErrors(
    eventId: number,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<ImportErrorListResponse> {
    let httpParams = new HttpParams().set('limit', limit.toString());

    if (lastEvaluatedKey) {
      httpParams = httpParams.set('lastEvaluatedKey', lastEvaluatedKey);
    }

    return this.http.get<ImportErrorListResponse>(
      `${this.apiUrl}/${eventId}/participants/batch-import/latest/errors`,
      { params: httpParams },
    );
  }

  /**
   * Get participant statistics for an event
   */
  getParticipantStatistics(eventId: number): Observable<ParticipantStatisticsResponse> {
    return this.http.get<ParticipantStatisticsResponse>(
      `${this.apiUrl}/${eventId}/participants/statistics`,
    );
  }

  /**
   * Export participants to CSV
   * @param eventId Event ID
   * @param fields Optional array of field names to export
   * @returns Observable of Blob (CSV file)
   */
  exportParticipants(eventId: number, fields?: string[]): Observable<Blob> {
    let httpParams = new HttpParams();
    if (fields && fields.length > 0) {
      fields.forEach((field) => {
        httpParams = httpParams.append('fields', field);
      });
    }

    return this.http.get(`${this.apiUrl}/${eventId}/participants/export`, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  /**
   * Get participant count for an event
   */
  getParticipantCount(eventId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/${eventId}/participants/count`);
  }

  /**
   * Get import job history for an event (paginated) — DEPRECATED
   * @deprecated Use getLatestImportErrors for batch import error retrieval
   */
  getImportHistory(
    eventId: number,
    page: number = 0,
    size: number = 20,
  ): Observable<ImportJobListResponse> {
    const httpParams = new HttpParams().set('page', page.toString()).set('size', size.toString());

    return this.http.get<ImportJobListResponse>(`${this.apiUrl}/${eventId}/participants/imports`, {
      params: httpParams,
    });
  }

  /**
   * Get paginated errors for a specific import — DEPRECATED
   * @deprecated Use getLatestBatchImportErrors instead
   */
  getImportErrors(
    eventId: number,
    importId: string,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<ImportErrorListResponse> {
    let httpParams = new HttpParams().set('limit', limit.toString());

    if (lastEvaluatedKey) {
      httpParams = httpParams.set('lastEvaluatedKey', lastEvaluatedKey);
    }

    return this.http.get<ImportErrorListResponse>(
      `${this.apiUrl}/${eventId}/participants/imports/${importId}/errors`,
      { params: httpParams },
    );
  }

  /**
   * Delete multiple participants in a single batch operation
   * Uses /api/events/{eventId}/participants/bulk endpoint
   * @param eventId Event ID
   * @param bibNumbers Array of BIB numbers to delete (min: 1, max: 25)
   * @returns Observable of delete response with counts
   */
  bulkDeleteParticipants(
    eventId: number,
    bibNumbers: string[],
  ): Observable<DeleteParticipantsResponse> {
    return this.http.delete<DeleteParticipantsResponse>(
      `${this.apiUrl}/${eventId}/participants/bulk`,
      {
        body: { bibNumbers },
      },
    );
  }
}
