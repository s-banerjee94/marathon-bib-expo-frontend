import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import {
  BibDistributionResponse,
  BulkCollectBibRequest,
  BulkDistributeGoodiesRequest,
  BulkDistributionResponse,
  CollectBibRequest,
  DistributeGoodiesRequest,
  DistributionLogListResponse,
  DistributionLogResponse,
  GoodiesDistributionResponse,
  LogSearchType,
  ParticipantDistributionResponse,
  PendingBibListResponse,
  PendingGoodiesListResponse,
  UndoDistributionResponse,
} from '../models/distribution.model';

@Injectable({ providedIn: 'root' })
export class DistributionService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/events`;

  getDistributionStatus(
    eventId: number,
    bibNumber: string,
  ): Observable<ParticipantDistributionResponse> {
    return this.http.get<ParticipantDistributionResponse>(
      `${this.apiUrl}/${eventId}/distribution/${bibNumber}/status`,
    );
  }

  collectBib(
    eventId: number,
    bibNumber: string,
    request?: CollectBibRequest,
  ): Observable<BibDistributionResponse> {
    return this.http.post<BibDistributionResponse>(
      `${this.apiUrl}/${eventId}/distribution/bib/${bibNumber}/collect`,
      request ?? {},
    );
  }

  undoBib(eventId: number, bibNumber: string): Observable<UndoDistributionResponse> {
    return this.http.post<UndoDistributionResponse>(
      `${this.apiUrl}/${eventId}/distribution/bib/${bibNumber}/undo`,
      {},
    );
  }

  bulkCollectBib(
    eventId: number,
    request: BulkCollectBibRequest,
  ): Observable<BulkDistributionResponse> {
    return this.http.post<BulkDistributionResponse>(
      `${this.apiUrl}/${eventId}/distribution/bib/bulk-collect`,
      request,
    );
  }

  distributeGoodies(
    eventId: number,
    bibNumber: string,
    request: DistributeGoodiesRequest,
  ): Observable<GoodiesDistributionResponse> {
    return this.http.post<GoodiesDistributionResponse>(
      `${this.apiUrl}/${eventId}/distribution/goodies/${bibNumber}/distribute`,
      request,
    );
  }

  bulkDistributeGoodies(
    eventId: number,
    request: BulkDistributeGoodiesRequest,
  ): Observable<BulkDistributionResponse> {
    return this.http.post<BulkDistributionResponse>(
      `${this.apiUrl}/${eventId}/distribution/goodies/bulk-distribute`,
      request,
    );
  }

  getPendingBibs(
    eventId: number,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<PendingBibListResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (lastEvaluatedKey) {
      params = params.set('lastEvaluatedKey', lastEvaluatedKey);
    }
    return this.http.get<PendingBibListResponse>(
      `${this.apiUrl}/${eventId}/distribution/pending/bib`,
      { params },
    );
  }

  getPendingGoodies(
    eventId: number,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<PendingGoodiesListResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (lastEvaluatedKey) {
      params = params.set('lastEvaluatedKey', lastEvaluatedKey);
    }
    return this.http.get<PendingGoodiesListResponse>(
      `${this.apiUrl}/${eventId}/distribution/pending/goodies`,
      { params },
    );
  }

  getDistributionLogs(
    eventId: number,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<DistributionLogListResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (lastEvaluatedKey) {
      params = params.set('lastEvaluatedKey', lastEvaluatedKey);
    }
    return this.http.get<DistributionLogListResponse>(
      `${this.apiUrl}/${eventId}/distribution/logs`,
      { params },
    );
  }

  lookupLogs(
    eventId: number,
    searchType: LogSearchType,
    searchValue: string,
    limit: number = 50,
    lastEvaluatedKey?: string,
  ): Observable<DistributionLogListResponse> {
    let params = new HttpParams()
      .set('searchType', searchType)
      .set('searchValue', searchValue)
      .set('limit', limit.toString());
    if (lastEvaluatedKey) {
      params = params.set('lastEvaluatedKey', lastEvaluatedKey);
    }
    return this.http.get<DistributionLogListResponse>(
      `${this.apiUrl}/${eventId}/distribution/logs/lookup`,
      { params },
    );
  }

  getParticipantLogs(eventId: number, bibNumber: string): Observable<DistributionLogListResponse> {
    return this.http.get<DistributionLogListResponse>(
      `${this.apiUrl}/${eventId}/distribution/logs/${bibNumber}`,
    );
  }
}
