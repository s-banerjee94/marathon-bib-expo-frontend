import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URI } from '../../shared/constants/api.constant';
import { AuditLogListResponse, AuditLogQuery } from '../models/audit-log.model';

@Injectable({
  providedIn: 'root',
})
export class AuditLogService {
  private http = inject(HttpClient);
  private apiUrl = `${BASE_URI}/audit-logs`;

  search(query: AuditLogQuery): Observable<AuditLogListResponse> {
    let params = new HttpParams();

    if (query.action) {
      params = params.set('action', query.action);
    }
    if (query.entityType) {
      params = params.set('entityType', query.entityType);
    }
    if (query.username) {
      params = params.set('username', query.username.trim());
    }
    if (query.organizationId !== undefined) {
      params = params.set('organizationId', query.organizationId.toString());
    }
    if (query.from) {
      params = params.set('from', query.from);
    }
    if (query.to) {
      params = params.set('to', query.to);
    }
    if (query.lastEvaluatedKey) {
      params = params.set('lastEvaluatedKey', query.lastEvaluatedKey);
    }

    return this.http.get<AuditLogListResponse>(this.apiUrl, { params });
  }
}
