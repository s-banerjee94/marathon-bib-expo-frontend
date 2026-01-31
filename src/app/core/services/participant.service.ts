import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Participant,
  ParticipantListResponse,
  ParticipantSearchParams,
  ImportParticipantsResponse,
  ParticipantStatistics,
  CreateParticipantRequest,
  UpdateParticipantRequest,
  ImportDetails,
  ImportHistoryItem,
} from '../models/participant.model';

@Injectable({
  providedIn: 'root',
})
export class ParticipantService {
  private http = inject(HttpClient);
  private apiUrl = '/api/events';

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

  deleteParticipant(eventId: number, bibNumber: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${eventId}/participants/${bibNumber}`);
  }

  /**
   * Import participants from CSV file (FULL REPLACE)
   * WARNING: This will delete all existing participants before importing
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
   * Get participant statistics for an event
   */
  getParticipantStatistics(eventId: number): Observable<ParticipantStatistics> {
    return this.http.get<ParticipantStatistics>(
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
   * Get detailed import job information
   * Uses /api/events/{eventId}/participants/imports/{importId} endpoint
   * @param eventId Event ID
   * @param importId Import job ID returned from import API
   * @returns Observable of ImportDetails
   */
  getImportDetails(eventId: number, importId: string): Observable<ImportDetails> {
    return this.http.get<ImportDetails>(
      `${this.apiUrl}/${eventId}/participants/imports/${importId}`,
    );
  }

  /**
   * Get import history for an event (paginated)
   * Uses /api/events/{eventId}/participants/imports endpoint
   * @param eventId Event ID
   * @param page Optional page number (0-indexed)
   * @param size Optional page size
   * @returns Observable of paginated import history
   */
  getImportHistory(eventId: number, page: number = 0, size: number = 20): Observable<any> {
    const httpParams = new HttpParams().set('page', page.toString()).set('size', size.toString());

    return this.http.get<any>(`${this.apiUrl}/${eventId}/participants/imports`, {
      params: httpParams,
    });
  }

  /**
   * Get paginated errors for a specific import
   * Uses /api/events/{eventId}/participants/imports/{importId}/errors endpoint
   * @param eventId Event ID
   * @param importId Import job ID
   * @param limit Maximum number of errors to return (default: 50)
   * @param lastEvaluatedKey Pagination token from previous response
   * @returns Observable of paginated import errors
   */
  getImportErrors(
    eventId: number,
    importId: string,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<any> {
    let httpParams = new HttpParams().set('limit', limit.toString());

    if (lastEvaluatedKey) {
      httpParams = httpParams.set('lastEvaluatedKey', lastEvaluatedKey);
    }

    return this.http.get<any>(`${this.apiUrl}/${eventId}/participants/imports/${importId}/errors`, {
      params: httpParams,
    });
  }
}
